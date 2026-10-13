"""Business logic for a board's metric definitions and their threshold versions.

No HTTP, and no session lifecycle beyond the commit each write ends with.
"""

import datetime
import logging
import uuid
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import exists, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, contains_eager

from app.core.exceptions import (
    DuplicateMetricGroupNameError,
    DuplicateMetricNameError,
    GlobalMetricAlreadyIncludedError,
    GlobalMetricReadOnlyError,
    MetricCopySourceGlobalError,
    MetricDirectionImmutableError,
    MetricGroupNotFoundError,
    MetricHasValuesError,
    MetricLayoutStaleError,
    MetricNotFoundError,
    MetricOwnerNotMemberError,
    MetricRetiredError,
    TeamNotFoundError,
)
from app.core.metric_enums import Scope
from app.models import (
    BoardMetric,
    Meeting,
    Metric,
    MetricGroup,
    MetricThreshold,
    MetricValue,
    Team,
    TeamMember,
)
from app.schemas.metric import (
    GlobalMetricInclusion,
    MetricChange,
    MetricCopy,
    MetricCreate,
    MetricGroupCreate,
    MetricGroupRename,
    MetricLayout,
    ThresholdCreate,
)
from app.services.metric_status import threshold_in_force

logger = logging.getLogger(__name__)

METRIC_NAME_UNIQUE_INDEX = "uq_metrics_team_name_lower"
METRIC_GROUP_NAME_UNIQUE_INDEX = "uq_metric_groups_team_name_lower"

#: The board's order, wherever a board's metrics are listed: its groups in
#: their order, the ungrouped metrics last, and within each by position.
BOARD_ORDER = (
    MetricGroup.position.asc().nulls_last(),
    BoardMetric.position,
    func.lower(Metric.name),
)


@dataclass(frozen=True, slots=True)
class MetricWithThreshold:
    """A metric on a board and the threshold version in force on the day asked about."""

    placement: BoardMetric
    threshold: MetricThreshold | None


def add_metric(
    session: Session, team_id: uuid.UUID, payload: MetricCreate, actor_email: str
) -> BoardMetric:
    """Add a metric of the board's own, with no threshold yet and not retired."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    _require_member_owner(session, team_id, payload.owner_employee_id)
    _require_group(session, team_id, payload.group_id)
    lock_boards_and_check_name(session, [team_id], payload.name)
    metric = Metric(
        team_id=team_id,
        name=payload.name,
        unit=payload.unit,
        decimals=payload.decimals,
        direction=payload.direction,
    )
    placement = BoardMetric(
        team_id=team_id,
        metric=metric,
        group_id=payload.group_id,
        position=_next_position(session, team_id, payload.group_id),
        owner_employee_id=payload.owner_employee_id,
    )
    session.add(placement)
    _commit(session, payload.name)
    logger.info("Metric %s of team %s added by %s", metric.id, team_id, actor_email)
    return placement


def include_global_metric(
    session: Session, team_id: uuid.UUID, payload: GlobalMetricInclusion, actor_email: str
) -> BoardMetric:
    """Place an active global metric on a board, once, under a name the board has free."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    metric = session.get(Metric, payload.global_metric_id)
    if metric is None or metric.team_id is not None:
        raise MetricNotFoundError(payload.global_metric_id)
    if metric.retired:
        raise MetricRetiredError(metric.id)
    _require_member_owner(session, team_id, payload.owner_employee_id)
    _require_group(session, team_id, payload.group_id)
    # The metric itself is excluded from the name check so that including it
    # twice reads as that, and checked for only once the board is locked.
    lock_boards_and_check_name(
        session, [team_id], metric.name, exclude_metric_id=metric.id, field="global_metric_id"
    )
    if session.get(BoardMetric, (team_id, metric.id)) is not None:
        raise GlobalMetricAlreadyIncludedError(metric.id)
    placement = BoardMetric(
        team_id=team_id,
        metric=metric,
        group_id=payload.group_id,
        position=_next_position(session, team_id, payload.group_id),
        owner_employee_id=payload.owner_employee_id,
    )
    session.add(placement)
    session.commit()
    logger.info("Global metric %s included in team %s by %s", metric.id, team_id, actor_email)
    return placement


def copy_metric(
    session: Session, team_id: uuid.UUID, payload: MetricCopy, actor_email: str
) -> BoardMetric:
    """Copy a board's own metric, of any board, onto this one as a metric of its own.

    The definition and every threshold version come along; the source's
    group and owner, which belong to the source's board, and the values do
    not. The copy goes last into the group named, or among the ungrouped. No
    link to the source is kept, so later changes on either side stay there.
    """
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    source = session.get(Metric, payload.source_metric_id)
    if source is None:
        raise MetricNotFoundError(payload.source_metric_id)
    if source.team_id is None:
        raise MetricCopySourceGlobalError(source.id)
    _require_group(session, team_id, payload.group_id)
    name = payload.name or source.name
    lock_boards_and_check_name(session, [team_id], name)
    metric = Metric(
        id=uuid.uuid4(),
        team_id=team_id,
        name=name,
        unit=source.unit,
        decimals=source.decimals,
        direction=source.direction,
    )
    placement = BoardMetric(
        team_id=team_id,
        metric=metric,
        group_id=payload.group_id,
        position=_next_position(session, team_id, payload.group_id),
    )
    session.add(placement)
    versions = session.scalars(
        select(MetricThreshold)
        .where(MetricThreshold.metric_id == source.id)
        .order_by(MetricThreshold.effective_from, MetricThreshold.recorded_at)
    ).all()
    # Same-date versions are told apart by when they were recorded, so the
    # copies are stamped explicitly, in the source's order, a microsecond
    # apart: the copy then has the source's version in force on every date.
    copied_at = datetime.datetime.now(datetime.UTC)
    session.add_all(
        MetricThreshold(
            metric_id=metric.id,
            effective_from=version.effective_from,
            green_lo=version.green_lo,
            green_hi=version.green_hi,
            amber_lo=version.amber_lo,
            amber_hi=version.amber_hi,
            reason=version.reason,
            recorded_by_email=actor_email,
            recorded_at=copied_at + datetime.timedelta(microseconds=i),
        )
        for i, version in enumerate(versions)
    )
    _commit(session, name)
    logger.info(
        "Metric %s copied from metric %s onto team %s by %s",
        metric.id,
        source.id,
        team_id,
        actor_email,
    )
    return placement


def list_metrics(
    session: Session, team_id: uuid.UUID, today: datetime.date
) -> list[MetricWithThreshold]:
    """A board's metrics, retired ones included, in the board's order.

    Each with its threshold in force today. Two statements however many
    metrics there are: the placements with their definitions, then every
    version of every one of them.
    """
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    placements = list(
        session.scalars(
            select(BoardMetric)
            .join(BoardMetric.metric)
            .outerjoin(BoardMetric.group)
            .options(contains_eager(BoardMetric.metric), contains_eager(BoardMetric.group))
            .where(BoardMetric.team_id == team_id)
            .order_by(*BOARD_ORDER)
        )
    )
    versions = versions_by_metric(session, [placement.metric_id for placement in placements])
    return [
        MetricWithThreshold(placement, threshold_in_force(versions[placement.metric_id], today))
        for placement in placements
    ]


def with_threshold(
    session: Session, placement: BoardMetric, today: datetime.date
) -> MetricWithThreshold:
    """A metric on a board with its threshold in force today."""
    versions = versions_by_metric(session, [placement.metric_id])[placement.metric_id]
    return MetricWithThreshold(placement, threshold_in_force(versions, today))


#: What a change touches on the definition, and what on the board's placement.
_DEFINITION_KEYS = frozenset({"name", "unit", "decimals"})
_PLACEMENT_KEYS = frozenset({"group_id", "owner_employee_id"})


def change_metric(
    session: Session,
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: MetricChange,
    actor_email: str,
) -> BoardMetric:
    """Change a metric's properties, retire it or bring it back.

    Only the keys the request carried change. The direction may be repeated
    but not changed: every threshold version is read through it.
    """
    placement = get_board_metric(session, team_id, metric_id)
    metric = placement.metric
    changes = payload.model_dump(exclude_unset=True)
    if metric.scope is Scope.GLOBAL:
        _refuse_a_global_definition_change(metric, changes)
    direction = changes.pop("direction", metric.direction)
    if direction != metric.direction:
        raise MetricDirectionImmutableError()
    if changes.get("owner_employee_id") is not None:
        _require_member_owner(session, team_id, changes["owner_employee_id"])
    if "name" in changes and changes["name"] != metric.name:
        lock_boards_and_check_name(session, [team_id], changes["name"], exclude_metric_id=metric_id)
    if "group_id" in changes and changes["group_id"] != placement.group_id:
        # Moved to another group, or out of every group: last there.
        _require_group(session, team_id, changes["group_id"])
        _lock_board(session, team_id)
        placement.position = _next_position(session, team_id, changes["group_id"])
    retired_before = placement.retired
    for key, value in changes.items():
        if key in _DEFINITION_KEYS:
            setattr(metric, key, value)
        elif key in _PLACEMENT_KEYS:
            setattr(placement, key, value)
        elif key == "retired":
            placement.retired_on_board = value
    _commit(session, metric.name)
    session.refresh(placement)
    logger.info("Metric %s of team %s changed by %s", metric_id, team_id, actor_email)
    if placement.retired != retired_before:
        event = "retired" if placement.retired else "brought back"
        logger.info("Metric %s of team %s %s by %s", metric_id, team_id, event, actor_email)
    return placement


def _refuse_a_global_definition_change(metric: Metric, changes: dict[str, object]) -> None:
    """A board places a global metric; its definition is changed in the catalogue.

    Repeating a property's current value is no change, so it is accepted and
    dropped, as an unchanged direction is for a board's own metric.
    """
    for key in ("name", "unit", "decimals", "direction"):
        if key in changes:
            if changes[key] != getattr(metric, key):
                raise GlobalMetricReadOnlyError(key)
            del changes[key]


def delete_metric(
    session: Session, team_id: uuid.UUID, metric_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a metric no value was ever recorded for, with its threshold versions.

    For a global metric, remove it from this board only, while no value was
    recorded for it at this team's meetings; other boards' values are theirs.
    """
    placement = get_board_metric(session, team_id, metric_id)
    if placement.metric.scope is Scope.GLOBAL:
        values_here = (
            select(MetricValue.metric_id)
            .join(Meeting, Meeting.id == MetricValue.meeting_id)
            .where(MetricValue.metric_id == metric_id, Meeting.team_id == team_id)
        )
        if session.scalar(select(exists(values_here))):
            raise MetricHasValuesError(metric_id)
        session.delete(placement)
        session.commit()
        logger.info("Global metric %s removed from team %s by %s", metric_id, team_id, actor_email)
        return
    if session.scalar(select(exists().where(MetricValue.metric_id == metric_id))):
        raise MetricHasValuesError(metric_id)
    session.delete(placement)
    session.delete(placement.metric)
    session.commit()
    logger.info("Metric %s of team %s deleted by %s", metric_id, team_id, actor_email)


def record_threshold(
    session: Session,
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: ThresholdCreate,
    actor_email: str,
) -> MetricThreshold:
    """Add a threshold version to a metric. Back-dating is allowed and intended.

    Versions are never edited: what a past meeting was judged against stays
    on record, and a mistake is corrected by a newer version.
    """
    placement = get_board_metric(session, team_id, metric_id)
    if placement.metric.scope is Scope.GLOBAL:
        # Whoever asks, an administrator included: a global threshold is
        # recorded in the catalogue, so the board route is no back door.
        raise GlobalMetricReadOnlyError()
    version = new_threshold_version(placement.metric, payload, actor_email)
    session.add(version)
    session.commit()
    session.refresh(version)
    logger.info(
        "Threshold %s of metric %s of team %s recorded by %s",
        version.id,
        metric_id,
        team_id,
        actor_email,
    )
    return version


def new_threshold_version(
    metric: Metric, payload: ThresholdCreate, actor_email: str
) -> MetricThreshold:
    """A version for a board's own metric or a global one, its bounds read by direction."""
    bounds = payload.bounds(metric.direction)
    return MetricThreshold(
        metric_id=metric.id,
        effective_from=payload.effective_from,
        green_lo=bounds.green_lo,
        green_hi=bounds.green_hi,
        amber_lo=bounds.amber_lo,
        amber_hi=bounds.amber_hi,
        reason=payload.reason,
        recorded_by_email=actor_email,
    )


def list_thresholds(
    session: Session, team_id: uuid.UUID, metric_id: uuid.UUID
) -> list[MetricThreshold]:
    """Every threshold version of a metric, the most recent first."""
    get_board_metric(session, team_id, metric_id)
    return list(
        session.scalars(
            select(MetricThreshold)
            .where(MetricThreshold.metric_id == metric_id)
            .order_by(MetricThreshold.effective_from.desc(), MetricThreshold.recorded_at.desc())
        )
    )


def versions_by_metric(
    session: Session, metric_ids: Iterable[uuid.UUID]
) -> defaultdict[uuid.UUID, list[MetricThreshold]]:
    """Every threshold version of these metrics, in one statement, keyed by metric."""
    ids = list(metric_ids)
    grouped: defaultdict[uuid.UUID, list[MetricThreshold]] = defaultdict(list)
    if ids:
        for version in session.scalars(
            select(MetricThreshold).where(MetricThreshold.metric_id.in_(ids))
        ):
            grouped[version.metric_id].append(version)
    return grouped


def list_groups(session: Session, team_id: uuid.UUID) -> list[MetricGroup]:
    """A board's groups in their order, empty ones included."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    return list(
        session.scalars(
            select(MetricGroup)
            .where(MetricGroup.team_id == team_id)
            .order_by(MetricGroup.position, func.lower(MetricGroup.name))
        )
    )


def add_group(
    session: Session, team_id: uuid.UUID, payload: MetricGroupCreate, actor_email: str
) -> MetricGroup:
    """Add a group to a board, after its other groups, holding no metric yet."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    _lock_board(session, team_id)
    last = session.scalar(
        select(func.max(MetricGroup.position)).where(MetricGroup.team_id == team_id)
    )
    group = MetricGroup(
        team_id=team_id, name=payload.name, position=0 if last is None else last + 1
    )
    session.add(group)
    _commit_group(session, payload.name)
    logger.info("Metric group %s of team %s added by %s", group.id, team_id, actor_email)
    return group


def rename_group(
    session: Session,
    team_id: uuid.UUID,
    group_id: uuid.UUID,
    payload: MetricGroupRename,
    actor_email: str,
) -> MetricGroup:
    """Rename a board's group; its metrics stay in it, in their order."""
    group = get_group(session, team_id, group_id)
    group.name = payload.name
    _commit_group(session, payload.name)
    logger.info("Metric group %s of team %s renamed by %s", group_id, team_id, actor_email)
    return group


def delete_group(
    session: Session, team_id: uuid.UUID, group_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a board's group; its metrics follow the ungrouped ones, in their order.

    Moved here rather than left to `ON DELETE SET NULL`, which would give them
    positions that clash with the ungrouped metrics already there. The groups
    after it close the gap.
    """
    group = get_group(session, team_id, group_id)
    _lock_board(session, team_id)
    start = _next_position(session, team_id, None)
    members = session.scalars(
        select(BoardMetric)
        .join(BoardMetric.metric)
        .where(BoardMetric.team_id == team_id, BoardMetric.group_id == group_id)
        .order_by(BoardMetric.position, func.lower(Metric.name))
    ).all()
    for offset, placement in enumerate(members):
        placement.group_id = None
        placement.position = start + offset
    session.flush()
    session.execute(
        update(MetricGroup)
        .where(MetricGroup.team_id == team_id, MetricGroup.position > group.position)
        .values(position=MetricGroup.position - 1)
    )
    session.delete(group)
    session.commit()
    logger.info(
        "Metric group %s of team %s deleted by %s; %d metrics ungrouped",
        group_id,
        team_id,
        actor_email,
        len(members),
    )


def arrange_layout(
    session: Session, team_id: uuid.UUID, payload: MetricLayout, actor_email: str
) -> None:
    """Replace a board's layout as one: its groups' order and every metric's place.

    The layout must name each of the board's groups and metrics, retired ones
    included, exactly once; anything else means the board changed since the
    client read it, and nothing is applied.
    """
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    _lock_board(session, team_id)
    groups = {
        group.id: group
        for group in session.scalars(
            select(MetricGroup).where(MetricGroup.team_id == team_id).with_for_update()
        )
    }
    placements = {
        placement.metric_id: placement
        for placement in session.scalars(
            # Only the placements: their owner and group are joined eagerly,
            # and a row on the nullable side of an outer join cannot be locked.
            select(BoardMetric)
            .where(BoardMetric.team_id == team_id)
            .with_for_update(of=BoardMetric)
        )
    }
    group_ids = [entry.id for entry in payload.groups]
    metric_ids = [
        *(metric_id for entry in payload.groups for metric_id in entry.metric_ids),
        *payload.ungrouped,
    ]
    if not (_exactly(group_ids, groups.keys()) and _exactly(metric_ids, placements.keys())):
        raise MetricLayoutStaleError()
    for group_position, entry in enumerate(payload.groups):
        groups[entry.id].position = group_position
        for position, metric_id in enumerate(entry.metric_ids):
            placements[metric_id].group_id = entry.id
            placements[metric_id].position = position
    for position, metric_id in enumerate(payload.ungrouped):
        placements[metric_id].group_id = None
        placements[metric_id].position = position
    session.commit()
    logger.info("Metric layout of team %s arranged by %s", team_id, actor_email)


def _exactly(submitted: list[uuid.UUID], present: Iterable[uuid.UUID]) -> bool:
    """Whether each identifier present is submitted once, and nothing else is."""
    return len(submitted) == len(set(submitted)) and set(submitted) == set(present)


def get_group(session: Session, team_id: uuid.UUID, group_id: uuid.UUID) -> MetricGroup:
    """A group of this board; another board's is as unknown as a missing one."""
    group = session.get(MetricGroup, group_id)
    if group is None or group.team_id != team_id:
        raise MetricGroupNotFoundError(group_id)
    return group


def _require_group(session: Session, team_id: uuid.UUID, group_id: uuid.UUID | None) -> None:
    """A metric is placed only in a group of its own board, reported against `group_id`."""
    if group_id is None:
        return
    group = session.get(MetricGroup, group_id)
    if group is None or group.team_id != team_id:
        raise MetricGroupNotFoundError(group_id, field="group_id")


def _next_position(session: Session, team_id: uuid.UUID, group_id: uuid.UUID | None) -> int:
    """The position after the last metric of a group, or of the ungrouped metrics."""
    in_container = (
        BoardMetric.group_id.is_(None) if group_id is None else BoardMetric.group_id == group_id
    )
    last = session.scalar(
        select(func.max(BoardMetric.position)).where(BoardMetric.team_id == team_id, in_container)
    )
    return 0 if last is None else last + 1


def _lock_board(session: Session, team_id: uuid.UUID) -> None:
    """Make writes that place metrics or groups on this board take turns.

    The same team row the name check locks, so an addition and a layout
    cannot interleave into an order neither saw.
    """
    session.execute(select(Team.id).where(Team.id == team_id).with_for_update())


def get_board_metric(session: Session, team_id: uuid.UUID, metric_id: uuid.UUID) -> BoardMetric:
    """A metric's placement on this board, with its definition loaded.

    `MetricNotFoundError` when the board has no such placement: another
    team's metric, and a global metric this board does not include, alike.
    """
    placement = session.get(BoardMetric, (team_id, metric_id))
    if placement is None:
        raise MetricNotFoundError(metric_id)
    return placement


def lock_boards_and_check_name(
    session: Session,
    team_ids: Iterable[uuid.UUID],
    name: str,
    *,
    exclude_metric_id: uuid.UUID | None = None,
    field: str = "name",
) -> None:
    """Refuse a name any metric on these boards already has, ignoring case.

    Own and included global metrics alike, retired ones too. The clash of an
    own metric with a global one spans two tables, so no index can decide
    it; instead every write that could create one locks the boards' team
    rows first, which makes two concurrent writes take turns. Locked in id
    order, so two writes over overlapping boards cannot deadlock.
    `exclude_metric_id` is the metric being renamed, which may keep its name
    in another letter case.
    """
    ids = sorted(set(team_ids))
    if not ids:
        return
    session.execute(select(Team.id).where(Team.id.in_(ids)).order_by(Team.id).with_for_update())
    clash = (
        select(BoardMetric.metric_id)
        .join(Metric, Metric.id == BoardMetric.metric_id)
        .where(BoardMetric.team_id.in_(ids), func.lower(Metric.name) == name.lower())
    )
    if exclude_metric_id is not None:
        clash = clash.where(Metric.id != exclude_metric_id)
    if session.scalar(select(exists(clash))):
        raise DuplicateMetricNameError(name, field)


def _require_member_owner(
    session: Session, team_id: uuid.UUID, employee_id: uuid.UUID | None
) -> None:
    if employee_id is not None and session.get(TeamMember, (team_id, employee_id)) is None:
        raise MetricOwnerNotMemberError(employee_id)


def _commit_group(session: Session, name: str) -> None:
    """Commit, turning a clash on the unique group name index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if METRIC_GROUP_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateMetricGroupNameError(name) from error
        raise


def _commit(session: Session, name: str) -> None:
    """Commit, turning a clash on the unique name index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if METRIC_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateMetricNameError(name) from error
        raise
