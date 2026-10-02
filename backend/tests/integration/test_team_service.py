"""The service layer, exercised directly against a session - no HTTP involved."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import DuplicateTeamNameError
from app.models import BoardDefinition, Team
from app.services import list_teams, register_team

LEADER = "lead@example.com"

pytestmark = pytest.mark.integration


def test_registering_a_team_creates_the_board_it_owns(session: Session) -> None:
    team = register_team(session, "Platform", LEADER)

    assert team.id is not None
    assert team.name == "Platform"
    assert team.board is not None
    assert team.board.name == "Platform"
    assert team.board.id != team.id
    assert team.board.team_id == team.id

    assert session.query(Team).count() == 1
    assert session.query(BoardDefinition).count() == 1


def test_a_duplicate_name_raises_the_domain_error_not_an_integrity_error(
    session: Session,
) -> None:
    register_team(session, "Platform", LEADER)

    with pytest.raises(DuplicateTeamNameError) as caught:
        register_team(session, "pLaTfOrM", LEADER)

    assert caught.value.field == "name"
    assert caught.value.status_code == 409
    assert not isinstance(caught.value, IntegrityError)
    assert session.query(Team).count() == 1


def test_the_session_is_usable_after_a_rejected_registration(session: Session) -> None:
    """The service rolls back, so the caller is not left with a poisoned session."""
    register_team(session, "Platform", LEADER)
    with pytest.raises(DuplicateTeamNameError):
        register_team(session, "platform", LEADER)

    register_team(session, "Quality", LEADER)

    assert [team.name for team in list_teams(session)] == ["Platform", "Quality"]
