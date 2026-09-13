"""Business logic for registering and retrieving teams.

No HTTP, and no session lifecycle: the caller provides the session.
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import DuplicateTeamNameError
from app.models import BoardDefinition, Team

TEAM_NAME_UNIQUE_INDEX = "ix_teams_name_lower"


def register_team(session: Session, name: str) -> Team:
    """Register a team together with the one board definition it owns.

    The board is created here rather than by a second call, so there is no
    window in which a team exists without a board.
    """
    team = Team(name=name)
    team.board = BoardDefinition(name=name)
    session.add(team)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        # The unique index is what detects a duplicate; a read-then-write check
        # would let two concurrent registrations both pass.
        if TEAM_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateTeamNameError(name) from error
        raise
    return team


def list_teams(session: Session) -> list[Team]:
    """Return every registered team, ordered by name ascending.

    Ordered case-insensitively to match how names are compared for uniqueness,
    so "alpha" and "Alpha" cannot sort into different halves of the list.
    """
    statement = select(Team).order_by(func.lower(Team.name))
    return list(session.scalars(statement).unique())
