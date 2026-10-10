"""One test per scenario of "Delete a meeting" in specs/meetings/spec.md."""

import uuid

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.teams_api import register


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
