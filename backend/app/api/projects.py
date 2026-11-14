"""A team's projects. Validate input, decide who may write, delegate, and return."""

import datetime
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.models import Project
from app.schemas.project import ProjectChange, ProjectCreate, ProjectRead
from app.services.authz import may_configure_the_board
from app.services.meetings import today
from app.services.projects import (
    add_project,
    change_project,
    delete_project,
    get_project,
    list_projects,
    past_end,
)

router = APIRouter(prefix="/teams/{team_id}/projects", tags=["projects"])

SessionDependency = Annotated[Session, Depends(get_session)]


def require_board_configurer(
    session: Session, current_user: CurrentUser, team_id: uuid.UUID
) -> None:
    """The team's leader, a deputy or an administrator, as for the board's metrics.

    A project's manager or a product's owner is not let in by being named.
    """
    require(
        may_configure_the_board(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )


def _read(project: Project, on: datetime.date) -> ProjectRead:
    return ProjectRead.model_validate(
        {
            "id": project.id,
            "team_id": project.team_id,
            "code": project.code,
            "name": project.name,
            "manager": project.manager,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "active": project.active,
            "past_end": past_end(project.active, project.end_date, on),
        }
    )


@router.get("", response_model=list[ProjectRead])
def get_projects(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[ProjectRead]:
    """Return the team's projects ordered by code, inactive ones included and marked."""
    on = today()
    return [_read(project, on) for project in list_projects(session, team_id)]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    team_id: uuid.UUID,
    payload: ProjectCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProjectRead:
    """Add an active project to the team."""
    require_board_configurer(session, current_user, team_id)
    return _read(add_project(session, team_id, payload, current_user.email), today())


@router.get("/{project_id}", response_model=ProjectRead)
def read_project(
    team_id: uuid.UUID, project_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> ProjectRead:
    """Return one project of the team."""
    return _read(get_project(session, team_id, project_id), today())


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    team_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProjectRead:
    """Change any property of a project, its status included."""
    require_board_configurer(session, current_user, team_id)
    project = change_project(session, team_id, project_id, payload, current_user.email)
    return _read(project, today())


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(
    team_id: uuid.UUID,
    project_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a project with its metrics, while none of them has a recorded value."""
    require_board_configurer(session, current_user, team_id)
    delete_project(session, team_id, project_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
