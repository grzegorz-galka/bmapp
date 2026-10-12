"""Business logic for a team's tasks.

The same lifecycle and the same checks as a problem's, from `problems`; what
is a task's own is the problem it may be raised from.
"""

import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    TaskArchivedError,
    TaskNotFoundError,
    TaskProblemArchivedError,
    TaskProblemNotFoundError,
)
from app.models import Problem, Task
from app.schemas.item import TaskChange, TaskCreate, TaskProblem, TaskRead
from app.services.item_lifecycle import apply_stage
from app.services.problems import (
    State,
    apply_changes,
    check_metric,
    check_references,
    check_responsible,
    in_order,
    log_raised,
    meeting_now,
    shared_read,
)


def raise_task(
    session: Session,
    team_id: uuid.UUID,
    payload: TaskCreate,
    actor_email: str,
    today: datetime.date,
) -> TaskRead:
    """Raise a task on a team, at the team's meeting of the moment, perhaps from a problem."""
    check_responsible(session, team_id, payload.responsible_employee_id)
    check_metric(session, team_id, payload.metric_id)
    check_problem(session, team_id, payload.problem_id)
    now = datetime.datetime.now(datetime.UTC)
    meeting = meeting_now(session, team_id, today)
    closed_at, closed_meeting = apply_stage(None, payload.stage, now, meeting)
    task = Task(
        team_id=team_id,
        summary=payload.summary,
        details=payload.details,
        responsible_employee_id=payload.responsible_employee_id,
        due_on=payload.due_on,
        metric_id=payload.metric_id,
        problem_id=payload.problem_id,
        stage=payload.stage,
        raised_at=now,
        raised_meeting_id=meeting.id if meeting else None,
        closed_at=closed_at,
        closed_meeting_id=closed_meeting.id if closed_meeting else None,
        updated_at=now,
    )
    session.add(task)
    session.commit()
    log_raised("Task", task, actor_email)
    session.refresh(task)
    return read_task(task, today)


def change_task(
    session: Session,
    team_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskChange,
    actor_email: str,
    today: datetime.date,
) -> TaskRead:
    """Change the fields of an active task that the payload names, and only those.

    A task's problem may be changed to another active problem of the team, or
    to none; the link it already has stays even after that problem closes.
    """
    task = session.scalars(
        select(Task).where(Task.id == task_id, Task.team_id == team_id).with_for_update(of=Task)
    ).one_or_none()
    if task is None:
        raise TaskNotFoundError(task_id)
    if task.archived:
        raise TaskArchivedError(task_id)
    check_references(session, task, payload)
    if "problem_id" in payload.model_fields_set and payload.problem_id != task.problem_id:
        check_problem(session, team_id, payload.problem_id)

    apply_changes(session, task, payload, today, actor_email, "Task")
    session.refresh(task)
    return read_task(task, today)


def list_tasks(
    session: Session, team_id: uuid.UUID, state: State, today: datetime.date
) -> list[TaskRead]:
    """A team's active or archived tasks, in the order the board lists them."""
    statement = in_order(select(Task).where(Task.team_id == team_id), Task, state)
    return [read_task(task, today) for task in session.scalars(statement)]


def check_problem(session: Session, team_id: uuid.UUID, problem_id: uuid.UUID | None) -> None:
    """A task's problem, when one is named, is an active problem of the same team.

    Another team's problem reads as not found, so an identifier says nothing
    about which team it belongs to.
    """
    if problem_id is None:
        return
    problem = session.get(Problem, problem_id)
    if problem is None or problem.team_id != team_id:
        raise TaskProblemNotFoundError(problem_id)
    if problem.archived:
        raise TaskProblemArchivedError(problem_id)


def read_task(task: Task, today: datetime.date) -> TaskRead:
    problem = (
        TaskProblem(id=task.problem.id, summary=task.problem.summary) if task.problem else None
    )
    return TaskRead.model_validate(
        {**shared_read(task, today), "details": task.details, "problem": problem}
    )
