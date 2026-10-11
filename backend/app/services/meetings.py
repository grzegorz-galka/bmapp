"""Business logic for the meetings a team holds.

No HTTP, and no session lifecycle beyond the commit each write ends with.
Wall-clock dates and times are in the organization's zone; `starts_at` is the
UTC instant they denote.
"""

import datetime
import logging
import uuid
from collections.abc import Collection
from dataclasses import dataclass

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    MeetingDateTakenError,
    MeetingHasPulseAnswersError,
    MeetingHasValuesError,
    MeetingHostNotMemberError,
    MeetingNotFoundError,
    TeamNotFoundError,
)
from app.core.time import ORGANIZATION_TZ
from app.models import (
    BoardDefinition,
    Meeting,
    MetricValue,
    PulseAnswer,
    Team,
    TeamMember,
    WeeklySchedule,
)

logger = logging.getLogger(__name__)

MEETING_DATE_UNIQUE_INDEX = "uq_meetings_team_local_date"


def to_instant(date: datetime.date, time: datetime.time) -> datetime.datetime:
    """The UTC instant at which this wall-clock date and time occur.

    `fold=0` decides the two hours a year that are not one-to-one: a time
    skipped when the clocks go forward is read with the offset before the
    change, and a time that happens twice when they go back is its first
    occurrence. Board meetings are not held at 02:30, so no rejection is
    worth the code it would take.
    """
    local = datetime.datetime.combine(date, time, tzinfo=ORGANIZATION_TZ)
    return local.astimezone(datetime.UTC)


def to_wall_clock(instant: datetime.datetime) -> tuple[datetime.date, datetime.time]:
    """The date and time the organization's clock shows at this instant."""
    local = instant.astimezone(ORGANIZATION_TZ)
    return local.date(), local.time().replace(tzinfo=None)


def today() -> datetime.date:
    """Today, as the organization's calendar reads it."""
    return datetime.datetime.now(ORGANIZATION_TZ).date()


def propose_next(
    schedule: WeeklySchedule | None,
    taken_dates: Collection[datetime.date],
    today: datetime.date,
) -> tuple[datetime.date, datetime.time] | None:
    """The date and time proposed for a team's next meeting, or None.

    The earliest day on or after `today` that falls on the scheduled weekday
    and has no meeting yet. On or after rather than after: on the scheduled
    day itself, before anyone has opened the meeting, today is the one to
    prepare - even once its start time has passed, since it may simply be
    running late. Meetings on other weekdays do not count as this week's.
    """
    if schedule is None:
        return None
    candidate = today + datetime.timedelta(days=(schedule.weekday - today.isoweekday()) % 7)
    while candidate in taken_dates:
        candidate += datetime.timedelta(days=7)
    return candidate, schedule.time


@dataclass(frozen=True, slots=True)
class MeetingOverview:
    """A team's meetings, earliest first, with its schedule and what comes next."""

    schedule: WeeklySchedule | None
    proposed: tuple[datetime.date, datetime.time] | None
    meetings: list[Meeting]


def open_meeting(
    session: Session,
    team_id: uuid.UUID,
    date: datetime.date,
    time: datetime.time,
    actor_email: str,
) -> Meeting:
    """Open a meeting of a team on a date at a start time, with no host.

    The date may be in the past, for a meeting that was held and never
    entered. One meeting per team per date is the unique index's to enforce.
    """
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    meeting = Meeting(
        team_id=team_id, starts_at=to_instant(date, time), created_by_email=actor_email
    )
    session.add(meeting)
    _commit(session, date)
    logger.info("Meeting %s of team %s opened by %s", meeting.id, team_id, actor_email)
    return meeting


def list_meetings(session: Session, team_id: uuid.UUID, today: datetime.date) -> MeetingOverview:
    """A team's meetings ordered by start, its schedule, and the proposed next one."""
    board = session.scalars(
        select(BoardDefinition).where(BoardDefinition.team_id == team_id)
    ).one_or_none()
    if board is None:
        raise TeamNotFoundError(team_id)
    meetings = list(
        session.scalars(
            select(Meeting).where(Meeting.team_id == team_id).order_by(Meeting.starts_at)
        )
    )
    taken = {meeting.date for meeting in meetings}
    return MeetingOverview(board.schedule, propose_next(board.schedule, taken, today), meetings)


def change_meeting(
    session: Session,
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    actor_email: str,
    *,
    date: datetime.date | None = None,
    time: datetime.time | None = None,
    set_host: bool = False,
    host_employee_id: uuid.UUID | None = None,
) -> Meeting:
    """Move a meeting, name or clear its host, or both, in one transaction.

    `date` and `time` left as None keep their current value. `set_host`
    distinguishes "clear the host" (True with None) from "leave it alone".
    The host is checked before anything is changed, so a rejected host also
    leaves the date as it was. Once values are recorded the date is fixed:
    they were judged against the thresholds in force on it. The start time
    may still change.
    """
    meeting = get_meeting(session, team_id, meeting_id)
    if date is not None and date != meeting.date and _has_values(session, meeting_id):
        raise MeetingHasValuesError(meeting_id)
    naming_a_host = set_host and host_employee_id is not None
    if naming_a_host and session.get(TeamMember, (team_id, host_employee_id)) is None:
        raise MeetingHostNotMemberError(host_employee_id)
    new_date = date or meeting.date
    if date is not None or time is not None:
        meeting.starts_at = to_instant(new_date, time or meeting.time)
    if set_host:
        meeting.host_employee_id = host_employee_id
    _commit(session, new_date)
    # The host relationship was loaded with the old identifier.
    session.refresh(meeting)
    logger.info("Meeting %s of team %s changed by %s", meeting.id, team_id, actor_email)
    return meeting


def delete_meeting(
    session: Session, team_id: uuid.UUID, meeting_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a meeting, freeing its date - unless values or pulse answers are recorded at it."""
    meeting = get_meeting(session, team_id, meeting_id)
    if _has_values(session, meeting_id):
        raise MeetingHasValuesError(meeting_id)
    if _has_pulse_answers(session, meeting_id):
        raise MeetingHasPulseAnswersError(meeting_id)
    session.delete(meeting)
    session.commit()
    logger.info("Meeting %s of team %s deleted by %s", meeting_id, team_id, actor_email)


def get_meeting(session: Session, team_id: uuid.UUID, meeting_id: uuid.UUID) -> Meeting:
    """A meeting of this team, or `MeetingNotFoundError` - also for another team's."""
    meeting = session.get(Meeting, meeting_id)
    if meeting is None or meeting.team_id != team_id:
        raise MeetingNotFoundError(meeting_id)
    return meeting


def _has_values(session: Session, meeting_id: uuid.UUID) -> bool:
    """Whether any metric value is recorded at this meeting.

    Checked here rather than left to the foreign key, which backs up deletion
    only: a meeting's date is derived from `starts_at`, so moving it has no
    database rule to fall back on.
    """
    return bool(session.scalar(select(exists().where(MetricValue.meeting_id == meeting_id))))


def _has_pulse_answers(session: Session, meeting_id: uuid.UUID) -> bool:
    """Whether anyone has answered the pulse check at this meeting.

    Deletion only: an answer is not judged against anything dated, so a
    meeting with answers can still be moved.
    """
    return bool(session.scalar(select(exists().where(PulseAnswer.meeting_id == meeting_id))))


def _commit(session: Session, date: datetime.date) -> None:
    """Commit, turning a clash on the one-meeting-per-date index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if MEETING_DATE_UNIQUE_INDEX in str(error.orig):
            raise MeetingDateTakenError(date) from error
        raise
