"""A team's tasks. Validate input, delegate, and return - nothing else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUserDependency
from app.api.problems import require_keeper
from app.core.db import get_session
from app.schemas import TaskChange, TaskCreate, TaskRead
from app.services import today
from app.services.problems import State, require_team
from app.services.tasks import change_task, list_tasks, raise_task

router = APIRouter(prefix="/teams/{team_id}/tasks", tags=["problems and tasks"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[TaskRead])
def get_tasks(
    team_id: uuid.UUID,
    session: SessionDependency,
    _: CurrentUserDependency,
    state: State = "active",
) -> list[TaskRead]:
    """Return the team's active or archived tasks. Any valid token reads."""
    require_team(session, team_id)
    return list_tasks(session, team_id, state, today())


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    team_id: uuid.UUID,
    payload: TaskCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TaskRead:
    """Raise a task on the team, perhaps from one of its active problems."""
    require_keeper(session, current_user, team_id)
    return raise_task(session, team_id, payload, current_user.email, today())


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    team_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TaskRead:
    """Change an active task. `problem_id: null` detaches it from its problem."""
    require_keeper(session, current_user, team_id)
    return change_task(session, team_id, task_id, payload, current_user.email, today())
