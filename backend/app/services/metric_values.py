"""Business logic for the values a board's metrics take at its meetings.

No HTTP, and no session lifecycle beyond the commit each write ends with.
Every status here comes from `status_of`; none is stored.
"""

import datetime
import logging
import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import exists, func, select, tuple_, union
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, contains_eager

from app.core.exceptions import (
    CorrectionReasonBlankError,
    DerivationIncompleteError,
    DerivationNoneError,
    DerivationPreviousMissingError,
    DerivationSourceMissingError,
    DerivedValueOutOfRangeError,
    DomainError,
    MeetingFrozenError,
    MetricRetiredError,
)
from app.core.metric_enums import DerivationKind, Direction, Status
from app.core.time import ORGANIZATION_TZ
from app.models import BoardMetric as Placement
from app.models import (
    Meeting,
    Metric,
    MetricDerivationSource,
    MetricThreshold,
    MetricValue,
    MetricValueCorrection,
    PulseAnswer,
    Team,
    TeamMember,
)
from app.schemas.meeting import MeetingRead
from app.schemas.metric import (
    BoardMetric,
    Completeness,
    CorrectionRead,
    DerivedReading,
    DerivedSource,
    DerivedValue,
    MeetingBoard,
    MetricDefinitionRead,
    MetricTrend,
    MetricValueRead,
    MetricValueWrite,
    MissingMetric,
    NamedRead,
    OwnerRead,
    SparklinePoint,
    TrendPoint,
    fits_a_stored_number,
)
from app.services.derivations import derive, load_derivations, meeting_read_at, previous_meeting
from app.services.meetings import get_meeting
from app.services.metric_status import bounds_of, status_of, threshold_in_force
from app.services.metrics import (
    BOARD_ORDER,
    get_board_metric,
    read_threshold,
    versions_by_metric,
)

logger = logging.getLogger(__name__)

#: How many of the team's meetings, up to the one shown, a tile's sparkline spans.
SPARKLINE_LENGTH = 12
#: How many meetings back the tile's second change indicator compares to.
#: It must stay inside the sparkline's window, whose values are already loaded.
COMPARE_BACK = 4


@dataclass(frozen=True, slots=True)
class Actor:
    """Who is recording a value, as far as the editing window cares."""

    email: str
    is_admin: bool


@dataclass(frozen=True, slots=True)
class MeetingDate:
    id: uuid.UUID
    date: datetime.date


def editable_meetings(
    meeting_dates: Iterable[datetime.date], today: datetime.date
) -> frozenset[datetime.date]:
    """The dates of the meetings whose values can still be recorded or changed.

    The latest meeting dated today or earlier - so the day after, a value that
    came in late can still go in - and the first dated after today, so values
    can be typed in before the meeting. Every other meeting is frozen: its
    record has been discussed and is no longer the team's to rewrite.
    """
    dates = set(meeting_dates)
    held = [date for date in dates if date <= today]
    coming = [date for date in dates if date > today]
    return frozenset({*([max(held)] if held else []), *([min(coming)] if coming else [])})


def record_value(
    session: Session,
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: MetricValueWrite,
    actor: Actor,
    today: datetime.date,
) -> MetricValueRead:
    """Record what a metric shows at a meeting, replacing what was there.

    Within the editing window anyone permitted may write. Outside it only an
    administrator may, with a reason, and the change is logged as a
    correction in the same transaction. A write that clears all three
    properties removes the entry, so the meeting no longer counts as having
    values.
    """
    placement = get_board_metric(session, team_id, metric_id)
    # The meeting is looked up by the team in the path, so a metric of one
    # team at a meeting of another reads as "no such meeting".
    meeting = get_meeting(session, team_id, meeting_id)
    if placement.retired:
        raise MetricRetiredError(metric_id)
    correcting = meeting.date not in editable_meetings(_dates(session, team_id), today)
    if correcting:
        if not actor.is_admin:
            raise MeetingFrozenError(meeting_id)
        if payload.reason is None:
            raise CorrectionReasonBlankError()

    existing = session.get(MetricValue, (metric_id, meeting_id))
    if correcting:
        session.add(
            MetricValueCorrection(
                metric_id=metric_id,
                meeting_id=meeting_id,
                old_value=existing.value if existing else None,
                old_manual_status=existing.manual_status if existing else None,
                old_comment=existing.comment if existing else None,
                new_value=payload.value,
                new_manual_status=payload.manual_status,
                new_comment=payload.comment,
                reason=payload.reason,
                corrected_by_email=actor.email,
            )
        )
    if payload.value is None and payload.manual_status is None and payload.comment is None:
        if existing is not None:
            session.delete(existing)
    else:
        _upsert(session, metric_id, meeting_id, payload, actor.email)
    session.commit()
    if correcting:
        logger.info(
            "Value of metric %s at meeting %s of team %s corrected by %s",
            metric_id,
            meeting_id,
            team_id,
            actor.email,
        )

    session.expire_all()
    stored = session.get(MetricValue, (metric_id, meeting_id))
    threshold = threshold_in_force(
        versions_by_metric(session, [metric_id])[metric_id], meeting.date
    )
    return MetricValueRead(
        metric_id=metric_id,
        meeting_id=meeting_id,
        value=stored.value if stored else None,
        manual_status=stored.manual_status if stored else None,
        comment=stored.comment if stored else None,
        status=_status(placement.metric, stored, threshold),
        set_by_hand=bool(stored and stored.manual_status),
        recorded_by_email=stored.recorded_by_email if stored else None,
        recorded_by_display_name=stored.recorded_by_display_name if stored else None,
        recorded_at=stored.recorded_at if stored else None,
    )


def build_board(
    session: Session, team_id: uuid.UUID, meeting_id: uuid.UUID, today: datetime.date
) -> MeetingBoard:
    """A meeting's board: every active metric, its value, status, change and sparkline.

    A fixed number of statements however many metrics the board has: the
    meeting, the team's meeting dates, the metrics, their thresholds, their
    values over the sparkline's meetings, and how many people owe data.
    """
    meeting = get_meeting(session, team_id, meeting_id)
    meetings = team_meeting_dates(session, team_id)
    position = next(i for i, m in enumerate(meetings) if m.id == meeting_id)
    window = meetings[max(0, position - SPARKLINE_LENGTH + 1) : position + 1]
    previous = meetings[position - 1] if position > 0 else None
    # By position, like `previous`: the trend runs along the meetings held,
    # so a skipped week does not shift the comparison onto a calendar date.
    four_back = meetings[position - COMPARE_BACK] if position >= COMPARE_BACK else None

    placements = list(
        session.scalars(
            select(Placement)
            .join(Placement.metric)
            .outerjoin(Placement.group)
            .options(contains_eager(Placement.metric), contains_eager(Placement.group))
            .where(
                Placement.team_id == team_id,
                Placement.retired_on_board.is_(False),
                Metric.retired.is_(False),
            )
            .order_by(*BOARD_ORDER)
        )
    )
    load_derivations(session, (placement.metric for placement in placements))
    metric_ids = [placement.metric_id for placement in placements]
    versions = versions_by_metric(session, metric_ids)
    values = _values(session, metric_ids, [m.id for m in window])

    tiles: list[BoardMetric] = []
    missing: list[MissingMetric] = []
    for placement in placements:
        metric = placement.metric
        threshold = threshold_in_force(versions[metric.id], meeting.date)
        entry = values.get((metric.id, meeting_id))
        before = values.get((metric.id, previous.id)) if previous else None
        number = entry.value if entry else None
        previous_number = before.value if before else None
        change = _change(number, previous_number)
        earlier = values.get((metric.id, four_back.id)) if four_back else None
        number_4 = earlier.value if earlier else None
        change_4 = _change(number, number_4)
        if number is None:
            missing.append(
                MissingMetric(metric_id=metric.id, name=metric.name, owner=_owner(placement))
            )
        tiles.append(
            BoardMetric(
                metric=MetricDefinitionRead.model_validate(placement),
                threshold=read_threshold(threshold, metric.direction) if threshold else None,
                value=number,
                status=_status(metric, entry, threshold),
                set_by_hand=bool(entry and entry.manual_status),
                comment=entry.comment if entry else None,
                manual_status=entry.manual_status if entry else None,
                previous=previous_number,
                change=change,
                improvement=_improvement(metric.direction, change),
                previous_4=number_4,
                change_4=change_4,
                improvement_4=_improvement(metric.direction, change_4),
                sparkline=[
                    _sparkline_point(metric, m, values.get((metric.id, m.id)), versions[metric.id])
                    for m in window
                ],
            )
        )
    return MeetingBoard(
        meeting=MeetingRead.model_validate(meeting),
        editable=meeting.date in editable_meetings((m.date for m in meetings), today),
        completeness=Completeness(
            recorded=len(placements) - len(missing),
            total=len(placements),
            missing=missing,
            owing=owing_by_meeting(session, [meeting_id])[meeting_id],
        ),
        metrics=tiles,
    )


@dataclass(frozen=True, slots=True)
class _Source:
    """One source of a derivation as deriving reads it."""

    team: NamedRead
    metric: NamedRead
    #: Retired on its board or in the catalogue: it gives no number.
    retired: bool
    #: A weighted mean's weight for this source; none for every other kind.
    weight: Decimal | None


def derive_value(
    session: Session, team_id: uuid.UUID, meeting_id: uuid.UUID, metric_id: uuid.UUID
) -> DerivedValue:
    """The number a metric's derivation gives at a meeting, and what it was worked out from.

    Records nothing. Refused, with one entry per missing piece, when a source
    has no number at the meeting it is read at - no meeting that week, none
    recorded, or retired - or a delta's previous meeting has none. A fixed
    number of statements however many sources: the metric, the meeting, the
    sources, their teams' meetings up to the meeting's week, and the values.
    """
    metric = get_board_metric(session, team_id, metric_id).metric
    kind = metric.derivation_kind
    if kind is None:
        raise DerivationNoneError(metric_id)
    meeting = get_meeting(session, team_id, meeting_id)
    recorded = MeetingDate(meeting.id, meeting.date)
    sources = _derivation_sources(session, metric_id)
    meetings = _meetings_up_to_the_week_of(
        session, {source.team.id for source in sources}, recorded.date
    )

    # Where each source is read, and for a delta the meeting before that.
    plan: list[tuple[_Source, MeetingDate | None, MeetingDate | None]] = []
    for source in sources:
        team_meetings = meetings[source.team.id]
        at = meeting_read_at(recorded, source.team.id == team_id, team_meetings)
        prior = previous_meeting(at, team_meetings) if at and kind is DerivationKind.DELTA else None
        plan.append((source, at, prior))
    numbers = _numbers(
        session,
        [(source.metric.id, m.id) for source, *read in plan for m in read if m is not None],
    )

    missing: list[DomainError] = []
    used: list[DerivedSource] = []
    for index, (source, at, prior) in enumerate(plan):
        number = numbers.get((source.metric.id, at.id)) if at and not source.retired else None
        if number is None:
            missing.append(
                DerivationSourceMissingError(index, source.team.name, source.metric.name)
            )
        previous: DerivedReading | None = None
        if kind is DerivationKind.DELTA and at is not None and not source.retired:
            earlier = numbers.get((source.metric.id, prior.id)) if prior else None
            if prior is None or earlier is None:
                missing.append(DerivationPreviousMissingError(source.team.name, source.metric.name))
            else:
                previous = DerivedReading(meeting_id=prior.id, date=prior.date, value=earlier)
        if at is not None and number is not None:
            used.append(
                DerivedSource(
                    team=source.team,
                    metric=source.metric,
                    meeting_id=at.id,
                    date=at.date,
                    value=number,
                    previous=previous,
                    weight=source.weight,
                )
            )
    if missing:
        raise DerivationIncompleteError(missing)
    value = derive(
        kind,
        [entry.value for entry in used],
        used[0].previous.value if used[0].previous else None,
        [entry.weight for entry in used if entry.weight is not None],
    )
    if not fits_a_stored_number(value):
        raise DerivedValueOutOfRangeError()
    return DerivedValue(value=value, kind=kind, sources=used)


def _derivation_sources(session: Session, metric_id: uuid.UUID) -> list[_Source]:
    """A derived metric's sources in order, named, and whether each is retired. One statement."""
    rows = session.execute(
        select(
            Team.id,
            Team.name,
            Metric.id,
            Metric.name,
            Metric.retired,
            Placement.retired_on_board,
            MetricDerivationSource.weight,
        )
        .select_from(MetricDerivationSource)
        .join(Team, Team.id == MetricDerivationSource.source_team_id)
        .join(Metric, Metric.id == MetricDerivationSource.source_metric_id)
        # Outer: a placement is kept while it is a source, but a missing one
        # must read as no number rather than lose the source from the list.
        .outerjoin(
            Placement,
            (Placement.team_id == MetricDerivationSource.source_team_id)
            & (Placement.metric_id == MetricDerivationSource.source_metric_id),
        )
        .where(MetricDerivationSource.metric_id == metric_id)
        .order_by(MetricDerivationSource.position)
    ).tuples()
    return [
        _Source(
            team=NamedRead(id=team, name=team_name),
            metric=NamedRead(id=metric, name=metric_name),
            retired=in_catalogue or on_board is not False,
            weight=weight,
        )
        for team, team_name, metric, metric_name, in_catalogue, on_board, weight in rows
    ]


def _meetings_up_to_the_week_of(
    session: Session, team_ids: set[uuid.UUID], date: datetime.date
) -> defaultdict[uuid.UUID, list[MeetingDate]]:
    """These teams' meetings up to the end of `date`'s ISO week, by team. One statement.

    Every earlier one too: a delta's previous meeting may lie any number of
    weeks back.
    """
    next_monday = date + datetime.timedelta(days=8 - date.isoweekday())
    end = datetime.datetime.combine(next_monday, datetime.time(0), tzinfo=ORGANIZATION_TZ)
    grouped: defaultdict[uuid.UUID, list[MeetingDate]] = defaultdict(list)
    rows = session.execute(
        select(Meeting.team_id, Meeting.id, Meeting.starts_at)
        .where(Meeting.team_id.in_(team_ids), Meeting.starts_at < end)
        .order_by(Meeting.starts_at)
    ).tuples()
    for team_id, meeting_id, starts_at in rows:
        grouped[team_id].append(
            MeetingDate(meeting_id, starts_at.astimezone(ORGANIZATION_TZ).date())
        )
    return grouped


def _numbers(
    session: Session, pairs: Sequence[tuple[uuid.UUID, uuid.UUID]]
) -> dict[tuple[uuid.UUID, uuid.UUID], Decimal]:
    """The numbers recorded for these (metric, meeting) pairs, where there is one. One statement."""
    if not pairs:
        return {}
    rows = session.execute(
        select(MetricValue.metric_id, MetricValue.meeting_id, MetricValue.value).where(
            tuple_(MetricValue.metric_id, MetricValue.meeting_id).in_(pairs),
            MetricValue.value.is_not(None),
        )
    ).tuples()
    return {
        (metric_id, meeting_id): value for metric_id, meeting_id, value in rows if value is not None
    }


def owing_by_meeting(session: Session, meeting_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    """How many people owe data for each of these meetings. One statement.

    The distinct employees among the owners of the active metrics on the
    meeting's team's board that have no number there, and the current
    members of the team who have not answered its pulse check. A metric
    without an owner adds no one; an owner counts whether or not they are
    still a member; a former member is not chased for the pulse check. The
    board and the dashboard both report this figure, so they cannot disagree.
    """
    owners = (
        select(Meeting.id.label("meeting_id"), Placement.owner_employee_id.label("employee_id"))
        .join(Placement, Placement.team_id == Meeting.team_id)
        .join(Metric, Metric.id == Placement.metric_id)
        .where(
            Meeting.id.in_(meeting_ids),
            Placement.owner_employee_id.is_not(None),
            Placement.retired_on_board.is_(False),
            Metric.retired.is_(False),
            ~exists().where(
                MetricValue.meeting_id == Meeting.id,
                MetricValue.metric_id == Placement.metric_id,
                MetricValue.value.is_not(None),
            ),
        )
    )
    unanswered = (
        select(Meeting.id.label("meeting_id"), TeamMember.employee_id.label("employee_id"))
        .join(TeamMember, TeamMember.team_id == Meeting.team_id)
        .where(
            Meeting.id.in_(meeting_ids),
            ~exists().where(
                PulseAnswer.meeting_id == Meeting.id,
                PulseAnswer.employee_id == TeamMember.employee_id,
            ),
        )
    )
    # UNION, not UNION ALL: a person with several gaps counts once.
    people = union(owners, unanswered).subquery()
    rows = session.execute(
        select(people.c.meeting_id, func.count()).group_by(people.c.meeting_id)
    ).tuples()
    counts = dict(rows.all())
    return {meeting_id: counts.get(meeting_id, 0) for meeting_id in meeting_ids}


def build_trend(session: Session, team_id: uuid.UUID, metric_id: uuid.UUID) -> MetricTrend:
    """A metric at every meeting of its team, earliest first, with its correction log.

    Each meeting is judged against the version in force on its own date, so
    a threshold change shows as a step. A week the team did not meet has no
    meeting and so no entry.
    """
    placement = get_board_metric(session, team_id, metric_id)
    metric = placement.metric
    meetings = team_meeting_dates(session, team_id)
    versions = versions_by_metric(session, [metric_id])[metric_id]
    values = _values(session, [metric_id], [m.id for m in meetings])
    # A global metric's corrections at other teams' meetings are theirs.
    corrections = session.scalars(
        select(MetricValueCorrection)
        .join(Meeting, Meeting.id == MetricValueCorrection.meeting_id)
        .where(MetricValueCorrection.metric_id == metric_id, Meeting.team_id == team_id)
        .order_by(MetricValueCorrection.corrected_at.desc())
    )
    points = []
    for meeting in meetings:
        entry = values.get((metric_id, meeting.id))
        threshold = threshold_in_force(versions, meeting.date)
        points.append(
            TrendPoint(
                meeting_id=meeting.id,
                date=meeting.date,
                value=entry.value if entry else None,
                status=_status(metric, entry, threshold),
                set_by_hand=bool(entry and entry.manual_status),
                manual_status=entry.manual_status if entry else None,
                comment=entry.comment if entry else None,
                threshold=read_threshold(threshold, metric.direction) if threshold else None,
            )
        )
    return MetricTrend(
        metric=MetricDefinitionRead.model_validate(placement),
        points=points,
        corrections=[CorrectionRead.model_validate(c) for c in corrections],
    )


def _upsert(
    session: Session,
    metric_id: uuid.UUID,
    meeting_id: uuid.UUID,
    payload: MetricValueWrite,
    actor_email: str,
) -> None:
    """Insert or replace in one statement, so two first writes cannot collide."""
    fields = {
        "value": payload.value,
        "manual_status": payload.manual_status,
        "comment": payload.comment,
        "recorded_by_email": actor_email,
    }
    statement = insert(MetricValue).values(metric_id=metric_id, meeting_id=meeting_id, **fields)
    session.execute(
        statement.on_conflict_do_update(
            index_elements=[MetricValue.metric_id, MetricValue.meeting_id],
            set_={**fields, "recorded_at": statement.excluded.recorded_at},
        )
    )


def _dates(session: Session, team_id: uuid.UUID) -> list[datetime.date]:
    return [meeting.date for meeting in team_meeting_dates(session, team_id)]


def team_meeting_dates(session: Session, team_id: uuid.UUID) -> list[MeetingDate]:
    """The team's meetings as identifiers and local dates, earliest first."""
    rows = session.execute(
        select(Meeting.id, Meeting.starts_at)
        .where(Meeting.team_id == team_id)
        .order_by(Meeting.starts_at)
    )
    return [
        MeetingDate(meeting_id, starts_at.astimezone(ORGANIZATION_TZ).date())
        for meeting_id, starts_at in rows
    ]


def _values(
    session: Session, metric_ids: Sequence[uuid.UUID], meeting_ids: Sequence[uuid.UUID]
) -> dict[tuple[uuid.UUID, uuid.UUID], MetricValue]:
    if not metric_ids or not meeting_ids:
        return {}
    rows = session.scalars(
        select(MetricValue).where(
            MetricValue.metric_id.in_(metric_ids), MetricValue.meeting_id.in_(meeting_ids)
        )
    )
    return {(row.metric_id, row.meeting_id): row for row in rows}


def _status(metric: Metric, entry: MetricValue | None, threshold: MetricThreshold | None) -> Status:
    """Judged against the boundaries the version amounts to, never its raw columns."""
    return status_of(
        metric.direction,
        entry.value if entry else None,
        entry.manual_status if entry else None,
        bounds_of(metric.direction, threshold) if threshold else None,
    )


def _sparkline_point(
    metric: Metric,
    meeting: MeetingDate,
    entry: MetricValue | None,
    versions: list[MetricThreshold],
) -> SparklinePoint:
    return SparklinePoint(
        meeting_id=meeting.id,
        date=meeting.date,
        value=entry.value if entry else None,
        status=_status(metric, entry, threshold_in_force(versions, meeting.date)),
    )


def _change(number: Decimal | None, earlier: Decimal | None) -> Decimal | None:
    """The difference since an earlier number, or None when either is missing."""
    return number - earlier if number is not None and earlier is not None else None


def _improvement(direction: Direction, change: Decimal | None) -> bool | None:
    """Whether a change is for the better: None for a band, or when nothing moved."""
    if change is None or change == 0 or direction is Direction.WITHIN_BAND:
        return None
    return change > 0 if direction is Direction.HIGHER_IS_BETTER else change < 0


def _owner(placement: Placement) -> OwnerRead | None:
    return OwnerRead.model_validate(placement.owner) if placement.owner else None
