"""Team endpoints. Validate input, delegate, and return - nothing else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.schemas import LeaderChange, MemberAdd, TeamCreate, TeamDetail, TeamRead
from app.services import (
    add_member,
    change_leader,
    get_team,
    list_teams,
    register_team,
    remove_member,
)

router = APIRouter(prefix="/teams", tags=["teams"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreate, session: SessionDependency) -> TeamRead:
    """Register a team, the board it owns, and its leader as its first member."""
    team = register_team(session, payload.name, payload.leader_email)
    return TeamRead.model_validate(team)


@router.get("", response_model=list[TeamRead])
def get_teams(session: SessionDependency) -> list[TeamRead]:
    """Return every registered team, ordered by name."""
    return [TeamRead.model_validate(team) for team in list_teams(session)]


@router.get("/{team_id}", response_model=TeamDetail)
def read_team(team_id: uuid.UUID, session: SessionDependency) -> TeamDetail:
    """Return one team with its members, ordered by email."""
    return TeamDetail.model_validate(get_team(session, team_id))


@router.post("/{team_id}/members", response_model=TeamDetail, status_code=status.HTTP_201_CREATED)
def create_member(team_id: uuid.UUID, payload: MemberAdd, session: SessionDependency) -> TeamDetail:
    """Add an employee to a team by email, recording the employee if new."""
    return TeamDetail.model_validate(add_member(session, team_id, payload.email))


@router.delete("/{team_id}/members/{employee_id}", response_model=TeamDetail)
def delete_member(
    team_id: uuid.UUID, employee_id: uuid.UUID, session: SessionDependency
) -> TeamDetail:
    """Remove a member who is not the leader from a team."""
    return TeamDetail.model_validate(remove_member(session, team_id, employee_id))


@router.put("/{team_id}/leader", response_model=TeamDetail)
def replace_leader(
    team_id: uuid.UUID, payload: LeaderChange, session: SessionDependency
) -> TeamDetail:
    """Make one of the team's members its leader."""
    return TeamDetail.model_validate(change_leader(session, team_id, payload.employee_id))
