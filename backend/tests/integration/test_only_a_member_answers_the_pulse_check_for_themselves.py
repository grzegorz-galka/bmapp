"""One test per scenario of "Only a member answers the pulse check, for themselves"
in specs/authorization/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.pulse_api import answer, freeze_today, put_answer, results_of
from tests.integration.teams_api import LEADER_EMAIL, register

ClientAs = Callable[[str], TestClient]
STRANGER = "stranger@example.com"


@pytest.fixture
def board(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    """A team, its leader's employee id, and its next meeting."""
    freeze_today(monkeypatch)
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    return team["id"], team["leader"]["id"], meeting["id"]


def test_the_leader_answers(client_as: ClientAs, board: tuple[str, str, str]) -> None:
    """Scenario: The leader answers."""
    team_id, leader_id, meeting = board

    recorded = answer(client_as(LEADER_EMAIL), team_id, meeting, 5)

    assert (recorded["employee_id"], recorded["email"]) == (leader_id, LEADER_EMAIL)


def _assert_refused(client: TestClient, caller: TestClient, board: tuple[str, str, str]) -> None:
    team_id, _, meeting = board

    response = put_answer(caller, team_id, meeting, 4)

    assert response.status_code == 403
    assert error_of(response) == (None, "auth.forbidden")
    assert results_of(client, team_id, meeting)["answered"] == 0


def test_a_stranger_cannot_answer(
    client: TestClient, client_as: ClientAs, board: tuple[str, str, str]
) -> None:
    """Scenario: A stranger cannot answer."""
    _assert_refused(client, client_as(STRANGER), board)


def test_an_administrator_who_is_not_a_member_cannot_answer(
    client: TestClient, board: tuple[str, str, str]
) -> None:
    """Scenario: An administrator who is not a member cannot answer."""
    _assert_refused(client, client, board)
