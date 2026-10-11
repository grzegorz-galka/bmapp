"""Business logic for the values a board's metrics take at its meetings.

No HTTP, and no session lifecycle beyond the commit each write ends with.
Every status here comes from `status_of`; none is stored.
"""

import datetime
import logging
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, contains_eager

from app.core.exceptions import CorrectionReasonBlankError, MeetingFrozenError, MetricRetiredError
from app.core.metric_enums import Direction, Status
from app.core.time import ORGANIZATION_TZ
from app.models import BoardMetric as Placement
from app.models import Meeting, Metric, MetricThreshold, MetricValue, MetricValueCorrection
from app.schemas.meeting import MeetingRead
from app.schemas.metric import (
    BoardMetric,
    Completeness,
    CorrectionRead,
    MeetingBoard,
    MetricDefinitionRead,
    MetricTrend,
    MetricValueRead,
    MetricValueWrite,
    MissingMetric,
    OwnerRead,
    SparklinePoint,
    ThresholdRead,
    TrendPoint,
)
from app.services.meetings import get_meeting
from app.services.metric_status import status_of, threshold_in_force
from app.services.metrics import get_board_metric, versions_by_metric

logger = logging.getLogger(__name__)

#: How many of the team's meetings, up to the one shown, a tile's sparkline spans.
SPARKLINE_LENGTH = 12


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
        recorded_at=stored.recorded_at if stored else None,
    )


def build_board(
    session: Session, team_id: uuid.UUID, meeting_id: uuid.UUID, today: datetime.date
) -> MeetingBoard:
    """A meeting's board: every active metric, its value, status, change and sparkline.

    A fixed number of statements however many metrics the board has: the
    meeting, the team's meeting dates, the metrics, their thresholds, and
    their values over the sparkline's meetings.
    """
    meeting = get_meeting(session, team_id, meeting_id)
    meetings = team_meeting_dates(session, team_id)
    position = next(i for i, m in enumerate(meetings) if m.id == meeting_id)
    window = meetings[max(0, position - SPARKLINE_LENGTH + 1) : position + 1]
    previous = meetings[position - 1] if position > 0 else None

    placements = list(
        session.scalars(
            select(Placement)
            .join(Placement.metric)
            .options(contains_eager(Placement.metric))
            .where(
                Placement.team_id == team_id,
                Placement.retired_on_board.is_(False),
                Metric.retired.is_(False),
            )
            .order_by(Placement.position, Metric.name)
        )
    )
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
        change = (
            number - previous_number if number is not None and previous_number is not None else None
        )
        if number is None:
            missing.append(
                MissingMetric(metric_id=metric.id, name=metric.name, owner=_owner(placement))
            )
        tiles.append(
            BoardMetric(
                metric=MetricDefinitionRead.model_validate(placement),
                threshold=ThresholdRead.model_validate(threshold) if threshold else None,
                value=number,
                status=_status(metric, entry, threshold),
                set_by_hand=bool(entry and entry.manual_status),
                comment=entry.comment if entry else None,
                manual_status=entry.manual_status if entry else None,
                previous=previous_number,
                change=change,
                improvement=_improvement(metric.direction, change),
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
            recorded=len(placements) - len(missing), total=len(placements), missing=missing
        ),
        metrics=tiles,
    )


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
                threshold=ThresholdRead.model_validate(threshold) if threshold else None,
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
    return status_of(
        metric.direction,
        entry.value if entry else None,
        entry.manual_status if entry else None,
        threshold,
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


def _improvement(direction: Direction, change: Decimal | None) -> bool | None:
    """Whether a change is for the better: None for a band, or when nothing moved."""
    if change is None or change == 0 or direction is Direction.WITHIN_BAND:
        return None
    return change > 0 if direction is Direction.HIGHER_IS_BETTER else change < 0


def _owner(placement: Placement) -> OwnerRead | None:
    return OwnerRead.model_validate(placement.owner) if placement.owner else None
