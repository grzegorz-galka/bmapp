"""One test per scenario of "Move a meeting" in specs/meetings/spec.md."""

import uuid

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"


def _hosted_meeting(client: TestClient, date: str) -> tuple[dict, dict]:
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], date)
    response = client.patch(
        f"/teams/{team['id']}/meetings/{meeting['id']}", json={"host_employee_id": host}
    )
    assert response.status_code == 200, response.json()
    return team, response.json()


def test_a_meeting_is_rescheduled(client: TestClient) -> None:
    """Scenario: A meeting is rescheduled."""
    team, meeting = _hosted_meeting(client, "2026-10-14")

    response = client.patch(
        f"/teams/{team['id']}/meetings/{meeting['id']}",
        json={"date": "2026-10-15", "time": "09:30"},
    )

    assert response.status_code == 200
    moved = response.json()
    assert (moved["date"], moved["time"]) == ("2026-10-15", "09:30")
    assert moved["id"] == meeting["id"]
    assert moved["host"] == meeting["host"] is not None


def test_a_meeting_is_moved_onto_a_date_already_taken(client: TestClient) -> None:
    """Scenario: A meeting is moved onto a date already taken."""
    team = register(client)
    open_meeting(client, team["id"], "2026-10-14")
    later = open_meeting(client, team["id"], "2026-10-21")

    response = client.patch(
        f"/teams/{team['id']}/meetings/{later['id']}", json={"date": "2026-10-14"}
    )

    assert response.status_code == 409
    assert error_of(response) == ("date", "meeting_date.taken")
    assert meetings_of(client, team["id"])["meetings"][1] == later


def test_only_the_start_time_changes(client: TestClient) -> None:
    """Scenario: Only the start time changes."""
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14", "13:00")

    response = client.patch(f"/teams/{team['id']}/meetings/{meeting['id']}", json={"time": "15:15"})

    assert (response.json()["date"], response.json()["time"]) == ("2026-10-14", "15:15")


def test_the_meeting_does_not_exist(client: TestClient) -> None:
    """Scenario: The meeting does not exist - including another team's meeting."""
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    theirs = open_meeting(client, other["id"], "2026-10-14")

    for meeting_id in (str(uuid.uuid4()), theirs["id"]):
        response = client.patch(
            f"/teams/{team['id']}/meetings/{meeting_id}", json={"time": "09:00"}
        )

        assert response.status_code == 404
        assert error_of(response) == (None, "meeting.not_found")
    assert meetings_of(client, other["id"])["meetings"] == [theirs]


def test_a_rejected_host_leaves_the_date_unchanged(client: TestClient) -> None:
    """A move and a host in one request stand or fall together."""
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = client.patch(
        f"/teams/{team['id']}/meetings/{meeting['id']}",
        json={"date": "2026-10-15", "host_employee_id": str(uuid.uuid4())},
    )

    assert response.status_code == 409
    assert meetings_of(client, team["id"])["meetings"] == [meeting]


def test_an_identifier_that_is_not_a_uuid(client: TestClient) -> None:
    team = register(client)

    response = client.patch(f"/teams/{team['id']}/meetings/not-a-uuid", json={"time": "09:00"})

    assert response.status_code == 422
    assert error_of(response) == ("meeting_id", "request.invalid_field")
