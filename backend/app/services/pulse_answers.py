"""Business logic for the pulse check: recording a member's answer and reading a meeting's results.

No HTTP, and no session lifecycle beyond the commit the one write ends with.
The arithmetic and the colour come from the pure functions in `pulse_check`.
Who may answer and who may read names is decided by the router through
`authz`; this module only honours the decision it is handed.
"""

import datetime
import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, contains_eager

from app.core.exceptions import PulseAnswerMeetingFrozenError
from app.core.time import ORGANIZATION_TZ
from app.models import Employee, Meeting, PulseAnswer, TeamMember
from app.schemas.pulse import (
    PulseAnswerRead,
    PulseAnswerWrite,
    PulseMissingMember,
    PulsePrevious,
    PulseResults,
    PulseTrendPoint,
)
from app.services.meetings import get_meeting
from app.services.metric_values import editable_meetings, team_meeting_dates
from app.services.pulse_check import mood_status, summarise

logger = logging.getLogger(__name__)

#: How many of the team's meetings with answers, up to the one shown, the trend spans.
TREND_LENGTH = 16


@dataclass(frozen=True, slots=True)
class Respondent:
    """Who is answering: the caller's employee record, and the email to log."""

    employee_id: uuid.UUID
    email: str


def record_answer(
    session: Session,
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    respondent: Respondent,
    payload: PulseAnswerWrite,
    today: datetime.date,
) -> PulseAnswerRead:
    """Record the respondent's own answer at a meeting, replacing their earlier one.

    Only at the meetings whose metric values can still be edited, and with no
    correction past that window for anyone: an answer is a person's own
    statement, not organizational data. The caller has already established
    that the respondent is on the team.
    """
    # Looked up by the team in the path, so another team's meeting reads as
    # "no such meeting".
    meeting = get_meeting(session, team_id, meeting_id)
    dates = (m.date for m in team_meeting_dates(session, team_id))
    if meeting.date not in editable_meetings(dates, today):
        raise PulseAnswerMeetingFrozenError(meeting_id)

    fields = {
        "rating": payload.rating,
        "positive": payload.positive,
        "negative": payload.negative,
        "better": payload.better,
    }
    statement = insert(PulseAnswer).values(
        meeting_id=meeting_id, employee_id=respondent.employee_id, **fields
    )
    # One statement, so two tabs saving a first answer at once cannot both
    # insert. `onupdate` does not fire for ON CONFLICT DO UPDATE, hence the
    # explicit timestamp.
    session.execute(
        statement.on_conflict_do_update(
            constraint="uq_pulse_answers_meeting_employee",
            set_={**fields, "updated_at": func.now()},
        )
    )
    session.commit()
    logger.info(
        "Pulse answer at meeting %s of team %s recorded by %s",
        meeting_id,
        team_id,
        respondent.email,
    )

    session.expire_all()
    stored = session.scalars(
        select(PulseAnswer).where(
            PulseAnswer.meeting_id == meeting_id,
            PulseAnswer.employee_id == respondent.employee_id,
        )
    ).one()
    return _read(stored)


def build_results(
    session: Session,
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    viewer_id: uuid.UUID | None,
    may_read_names: bool,
    today: datetime.date,
) -> PulseResults:
    """The pulse check of one meeting, computed from its answers when read.

    A fixed number of statements however large the team and however long its
    history: the meeting, the team's meeting dates, this meeting's answers,
    the team's current members, and the trend grouped in SQL. When the viewer
    may not read names, `answers`, `missing` and `own` are null rather than
    built and dropped by the caller.
    """
    meeting = get_meeting(session, team_id, meeting_id)
    dates = (m.date for m in team_meeting_dates(session, team_id))
    answers = list(
        session.scalars(
            select(PulseAnswer)
            .join(PulseAnswer.employee)
            .options(contains_eager(PulseAnswer.employee))
            .where(PulseAnswer.meeting_id == meeting_id)
            .order_by(Employee.email)
        )
    )
    members = list(
        session.scalars(
            select(TeamMember)
            .join(TeamMember.employee)
            .options(contains_eager(TeamMember.employee))
            .where(TeamMember.team_id == team_id)
            .order_by(Employee.email)
        )
    )
    trend = _trend(session, team_id, meeting)

    summary = summarise(answer.rating for answer in answers)
    answered_ids = {answer.employee_id for answer in answers}
    missing = [member for member in members if member.employee_id not in answered_ids]
    # The latest earlier meeting with answers: the last point of the trend
    # before this meeting, which is the trend's own last point when nobody
    # has answered here.
    earlier = [point for point in trend if point.meeting_id != meeting_id]
    previous = earlier[-1] if earlier else None
    change = (
        summary.average - previous.average
        if summary.average is not None and previous is not None and previous.average is not None
        else None
    )

    reads = [_read(answer) for answer in answers] if may_read_names else None
    return PulseResults(
        meeting_id=meeting_id,
        editable=meeting.date in editable_meetings(dates, today),
        answered=summary.count,
        members=len(members),
        average=summary.average,
        status=mood_status(summary.average),
        previous=(
            PulsePrevious(
                meeting_id=previous.meeting_id, date=previous.date, average=previous.average
            )
            if previous is not None and previous.average is not None
            else None
        ),
        change=change,
        distribution=summary.distribution,
        trend=trend,
        answers=reads,
        missing=(
            [PulseMissingMember(employee_id=m.employee_id, email=m.email) for m in missing]
            if may_read_names
            else None
        ),
        missing_count=len(missing),
        own=(
            next((read for read in reads if read.employee_id == viewer_id), None)
            if reads is not None and viewer_id is not None
            else None
        ),
    )


def _trend(session: Session, team_id: uuid.UUID, meeting: Meeting) -> list[PulseTrendPoint]:
    """The team's last meetings with answers up to and including this one, earliest first.

    Sum and count are grouped in SQL and divided here, as `summarise` divides,
    so the point for the meeting shown carries exactly its own average.
    """
    rows = session.execute(
        select(
            Meeting.id,
            Meeting.starts_at,
            func.sum(PulseAnswer.rating),
            func.count(PulseAnswer.id),
        )
        .join(PulseAnswer, PulseAnswer.meeting_id == Meeting.id)
        .where(Meeting.team_id == team_id, Meeting.starts_at <= meeting.starts_at)
        .group_by(Meeting.id, Meeting.starts_at)
        .order_by(Meeting.starts_at.desc())
        .limit(TREND_LENGTH)
    ).all()
    return [
        PulseTrendPoint(
            meeting_id=meeting_id,
            date=starts_at.astimezone(ORGANIZATION_TZ).date(),
            average=average,
            status=mood_status(average),
            answered=count,
        )
        for meeting_id, starts_at, total, count in reversed(rows)
        for average in [Decimal(total) / count]
    ]


def _read(answer: PulseAnswer) -> PulseAnswerRead:
    return PulseAnswerRead(
        employee_id=answer.employee_id,
        email=answer.email,
        rating=answer.rating,
        status=mood_status(Decimal(answer.rating)),
        positive=answer.positive,
        negative=answer.negative,
        better=answer.better,
        updated_at=answer.updated_at,
    )
