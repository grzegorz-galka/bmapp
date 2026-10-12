"""Business logic for a team's problems, and the checks a problem and a task share.

No HTTP, and no session lifecycle beyond the commit each write ends with. The
stage, closing and the meeting of the moment come from the pure rule in
`item_lifecycle`; who may raise or change an item is decided by the router
through `authz`. The checks every item makes of its references live here and
`tasks` imports them, so the two kinds cannot drift apart.
"""

import datetime
import logging
import uuid
from typing import Literal

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ItemMetricNotOnBoardError,
    ItemResponsibleNotMemberError,
    ProblemArchivedError,
    ProblemNotFoundError,
    TeamNotFoundError,
)
from app.models import BoardMetric, Meeting, Problem, Task, Team, TeamMember
from app.schemas.item import (
    ItemMeeting,
    ItemMetric,
    ItemResponsible,
    ProblemChange,
    ProblemCreate,
    ProblemRead,
    TaskChange,
)
from app.services.item_lifecycle import apply_stage, is_overdue, meeting_of_the_moment
from app.services.metric_values import MeetingDate, team_meeting_dates

logger = logging.getLogger(__name__)

#: Which of a team's items a list asks for.
State = Literal["active", "archived"]


def require_team(session: Session, team_id: uuid.UUID) -> None:
    """`TeamNotFoundError` unless the team exists - asked before the permission."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)


def raise_problem(
    session: Session,
    team_id: uuid.UUID,
    payload: ProblemCreate,
    actor_email: str,
    today: datetime.date,
) -> ProblemRead:
    """Raise a problem on a team, at the team's meeting of the moment.

    Raised at `act`, it is closed and archived at once, at the same time and
    meeting as it was raised.
    """
    check_responsible(session, team_id, payload.responsible_employee_id)
    check_metric(session, team_id, payload.metric_id)
    now = datetime.datetime.now(datetime.UTC)
    meeting = meeting_now(session, team_id, today)
    closed_at, closed_meeting = apply_stage(None, payload.stage, now, meeting)
    problem = Problem(
        team_id=team_id,
        summary=payload.summary,
        reason=payload.reason,
        solution=payload.solution,
        responsible_employee_id=payload.responsible_employee_id,
        due_on=payload.due_on,
        metric_id=payload.metric_id,
        stage=payload.stage,
        raised_at=now,
        raised_meeting_id=meeting.id if meeting else None,
        closed_at=closed_at,
        closed_meeting_id=closed_meeting.id if closed_meeting else None,
        updated_at=now,
    )
    session.add(problem)
    session.commit()
    log_raised("Problem", problem, actor_email)
    session.refresh(problem)
    return read_problem(problem, today)


def change_problem(
    session: Session,
    team_id: uuid.UUID,
    problem_id: uuid.UUID,
    payload: ProblemChange,
    actor_email: str,
    today: datetime.date,
) -> ProblemRead:
    """Change the fields of an active problem that the payload names, and only those.

    Every reference is checked before anything is set, so a rejected change
    leaves the problem as it was. The row is locked first, so two members
    closing it at once take turns and the second is told it is archived.
    """
    problem = session.scalars(
        select(Problem)
        .where(Problem.id == problem_id, Problem.team_id == team_id)
        .with_for_update(of=Problem)
    ).one_or_none()
    if problem is None:
        raise ProblemNotFoundError(problem_id)
    if problem.archived:
        raise ProblemArchivedError(problem_id)
    check_references(session, problem, payload)
    apply_changes(session, problem, payload, today, actor_email, "Problem")
    session.refresh(problem)
    return read_problem(problem, today)


def list_problems(
    session: Session, team_id: uuid.UUID, state: State, today: datetime.date
) -> list[ProblemRead]:
    """A team's active or archived problems, in the order the board lists them."""
    statement = in_order(select(Problem).where(Problem.team_id == team_id), Problem, state)
    return [read_problem(problem, today) for problem in session.scalars(statement)]


def read_problem(problem: Problem, today: datetime.date) -> ProblemRead:
    return ProblemRead.model_validate(
        {**shared_read(problem, today), "reason": problem.reason, "solution": problem.solution}
    )


# --- What a problem and a task share ---------------------------------------------


def check_responsible(session: Session, team_id: uuid.UUID, employee_id: uuid.UUID | None) -> None:
    """A responsible person, when one is set, is a member of the team now."""
    if employee_id is not None and session.get(TeamMember, (team_id, employee_id)) is None:
        raise ItemResponsibleNotMemberError(employee_id)


def check_metric(session: Session, team_id: uuid.UUID, metric_id: uuid.UUID | None) -> None:
    """A linked metric, when one is set, is placed on the team's board now.

    The board's own or an included global one alike: both have a placement.
    """
    if metric_id is not None and session.get(BoardMetric, (team_id, metric_id)) is None:
        raise ItemMetricNotOnBoardError(metric_id)


def check_references(
    session: Session, item: Problem | Task, payload: ProblemChange | TaskChange
) -> None:
    """Check the responsible person and the metric a change sets, if it changes them.

    A value equal to the current one is not checked again: a person who has
    left the team stays responsible, and a metric since removed from the
    board stays linked, until someone changes it.
    """
    for name, check in (
        ("responsible_employee_id", check_responsible),
        ("metric_id", check_metric),
    ):
        value = getattr(payload, name)
        if name in payload.model_fields_set and value != getattr(item, name):
            check(session, item.team_id, value)


def meeting_now(session: Session, team_id: uuid.UUID, today: datetime.date) -> MeetingDate | None:
    """The team's meeting of the moment: the one a change made today belongs to."""
    return meeting_of_the_moment(team_meeting_dates(session, team_id), today)


def apply_changes(
    session: Session,
    item: Problem | Task,
    payload: ProblemChange | TaskChange,
    today: datetime.date,
    actor_email: str,
    kind: str,
) -> None:
    """Set the fields the payload names, close the item if it reaches `act`, commit and log.

    The stage is the target, so the same stage set twice is no change at all.
    """
    now = datetime.datetime.now(datetime.UTC)
    given = payload.model_fields_set - {"stage"}
    for name in given:
        setattr(item, name, getattr(payload, name))
    stage = payload.stage if "stage" in payload.model_fields_set else None
    moved = stage is not None and stage is not item.stage
    if stage is not None and moved:
        meeting = meeting_now(session, item.team_id, today)
        closed_at, closed_meeting = apply_stage(item.closed_at, stage, now, meeting)
        item.stage = stage
        item.closed_at = closed_at
        item.closed_meeting_id = closed_meeting.id if closed_meeting else None
    if given or moved:
        item.updated_at = now
    session.commit()
    if moved:
        logger.info(
            "%s %s of team %s moved to %s by %s", kind, item.id, item.team_id, stage, actor_email
        )
        if item.archived:
            logger.info("%s %s of team %s closed by %s", kind, item.id, item.team_id, actor_email)


def log_raised(kind: str, item: Problem | Task, actor_email: str) -> None:
    logger.info("%s %s of team %s raised by %s", kind, item.id, item.team_id, actor_email)
    if item.archived:
        logger.info("%s %s of team %s closed by %s", kind, item.id, item.team_id, actor_email)


def in_order[S: (Problem, Task)](
    statement: Select[tuple[S]], model: type[S], state: State
) -> Select[tuple[S]]:
    """Active items by due date, none last, then as raised; archived ones latest closed first."""
    if state == "archived":
        return statement.where(model.closed_at.is_not(None)).order_by(
            model.closed_at.desc(), model.id
        )
    return statement.where(model.closed_at.is_(None)).order_by(
        model.due_on.asc().nulls_last(), model.raised_at, model.id
    )


def shared_read(item: Problem | Task, today: datetime.date) -> dict[str, object]:
    """The fields of a read both kinds carry."""
    return {
        "id": item.id,
        "team_id": item.team_id,
        "summary": item.summary,
        "responsible": (
            ItemResponsible(employee_id=item.responsible.id, email=item.responsible.email)
            if item.responsible
            else None
        ),
        "due_on": item.due_on,
        "metric": ItemMetric(id=item.metric.id, name=item.metric.name) if item.metric else None,
        "stage": item.stage,
        "archived": item.archived,
        "overdue": is_overdue(item.due_on, item.closed_at, today),
        "raised_at": item.raised_at,
        "raised_meeting": _meeting(item.raised_meeting),
        "closed_at": item.closed_at,
        "closed_meeting": _meeting(item.closed_meeting),
        "updated_at": item.updated_at,
    }


def _meeting(meeting: Meeting | None) -> ItemMeeting | None:
    return ItemMeeting(id=meeting.id, date=meeting.date) if meeting else None
