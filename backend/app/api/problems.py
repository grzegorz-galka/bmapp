"""A team's problems. Validate input, delegate, and return - nothing else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.schemas import ProblemChange, ProblemCreate, ProblemRead
from app.services import today
from app.services.authz import may_record_meeting_data
from app.services.problems import (
    State,
    change_problem,
    list_problems,
    raise_problem,
    require_team,
)

router = APIRouter(prefix="/teams/{team_id}/problems", tags=["problems and tasks"])

SessionDependency = Annotated[Session, Depends(get_session)]


def require_keeper(session: Session, current_user: CurrentUser, team_id: uuid.UUID) -> None:
    """The team first, then the permission: a stranger learns no more than that they may not.

    Any member of the team, its leader included, or an administrator - the
    same rule as for the rest of a meeting's data. Asked before the service
    looks at the item, so a stranger hears `auth.forbidden`, never that an
    item is archived.
    """
    require_team(session, team_id)
    require(
        may_record_meeting_data(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )


@router.get("", response_model=list[ProblemRead])
def get_problems(
    team_id: uuid.UUID,
    session: SessionDependency,
    _: CurrentUserDependency,
    state: State = "active",
) -> list[ProblemRead]:
    """Return the team's active or archived problems. Any valid token reads."""
    require_team(session, team_id)
    return list_problems(session, team_id, state, today())


@router.post("", response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(
    team_id: uuid.UUID,
    payload: ProblemCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProblemRead:
    """Raise a problem on the team."""
    require_keeper(session, current_user, team_id)
    return raise_problem(session, team_id, payload, current_user.email, today())


@router.patch("/{problem_id}", response_model=ProblemRead)
def update_problem(
    team_id: uuid.UUID,
    problem_id: uuid.UUID,
    payload: ProblemChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProblemRead:
    """Change an active problem. A key left out is left alone; `null` clears an optional one."""
    require_keeper(session, current_user, team_id)
    return change_problem(session, team_id, problem_id, payload, current_user.email, today())
