"""One test per scenario of "Delete a meeting" in specs/meetings/spec.md."""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration import pulse_api
from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, record, tile
from tests.integration.teams_api import LEADER_EMAIL, register


def test_a_meeting_opened_by_mistake_is_deleted(client: TestClient) -> None:
    """Scenario: A meeting opened by mistake is deleted."""
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = client.delete(f"/teams/{team['id']}/meetings/{meeting['id']}")

    assert response.status_code == 204
    assert meetings_of(client, team["id"])["meetings"] == []
    open_meeting(client, team["id"], "2026-10-14")


def test_the_meeting_does_not_exist(client: TestClient) -> None:
    """Scenario: The meeting does not exist."""
    team = register(client)

    response = client.delete(f"/teams/{team['id']}/meetings/{uuid.uuid4()}")

    assert response.status_code == 404
    assert error_of(response) == (None, "meeting.not_found")


def test_a_meeting_with_values_cannot_be_deleted(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A meeting with values cannot be deleted."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], metric["id"], value="1")

    response = client.delete(f"/teams/{team['id']}/meetings/{meeting['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "meeting.has_values")
    assert meetings_of(client, team["id"])["meetings"] == [meeting]
    assert tile(board_of(client, team["id"], meeting["id"]), metric["id"])["value"] == "1"


def test_a_meeting_with_pulse_answers_cannot_be_deleted(
    client: TestClient, client_as: Callable[[str], TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A meeting with pulse answers cannot be deleted."""
    pulse_api.freeze_today(monkeypatch)
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    pulse_api.answer(client_as(LEADER_EMAIL), team["id"], meeting["id"], 4)

    response = client.delete(f"/teams/{team['id']}/meetings/{meeting['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "meeting.has_pulse_answers")
    assert meetings_of(client, team["id"])["meetings"] == [meeting]
    assert pulse_api.results_of(client, team["id"], meeting["id"])["answered"] == 1
