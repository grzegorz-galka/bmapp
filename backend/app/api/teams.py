"""Team endpoints. Validate input, delegate, and return - nothing else."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.schemas import TeamCreate, TeamRead
from app.services import list_teams, register_team

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreate, session: Annotated[Session, Depends(get_session)]) -> TeamRead:
    """Register a team and the board it owns."""
    team = register_team(session, payload.name)
    return TeamRead.model_validate(team)


@router.get("", response_model=list[TeamRead])
def get_teams(session: Annotated[Session, Depends(get_session)]) -> list[TeamRead]:
    """Return every registered team, ordered by name."""
    return [TeamRead.model_validate(team) for team in list_teams(session)]
