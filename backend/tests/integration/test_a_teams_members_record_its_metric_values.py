"""Requirement: A team's members record its metric values."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, put_value, tile
from tests.integration.teams_api import add, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
STRANGER = "stranger@pse.pl"


@pytest.fixture
def board(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    freeze_today(monkeypatch)
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)
    metric = add_metric(client, team["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    return team["id"], meeting["id"], metric["id"]


def test_a_member_records_a_value(
    client_as: Callable[[str], TestClient], board: tuple[str, str, str]
) -> None:
    """Scenario: A member records a value."""
    response = put_value(client_as(MEMBER), *board, value="96")

    assert response.status_code == 200
    assert response.json()["recorded_by_email"] == MEMBER


def test_a_stranger_cannot_record_a_value(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    board: tuple[str, str, str],
) -> None:
    """Scenario: A stranger cannot record a value."""
    # An employee, and a leader - of another team, which grants nothing here.
    register(client, "Other", STRANGER)

    response = put_value(client_as(STRANGER), *board, value="96")

    assert response.status_code == 403
    assert error_of(response) == (None, "auth.forbidden")
    assert tile(board_of(client, board[0], board[1]), board[2])["value"] is None
