"""One test per scenario of "Open a meeting" in specs/meetings/spec.md."""

import uuid

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.teams_api import register


def test_a_meeting_is_opened(client: TestClient) -> None:
    """Scenario: A meeting is opened."""
    team = register(client)

    meeting = open_meeting(client, team["id"], "2026-10-14", "13:00")

    assert uuid.UUID(meeting["id"])
    assert meeting["team_id"] == team["id"]
    assert (meeting["date"], meeting["time"]) == ("2026-10-14", "13:00")
    assert meeting["starts_at"] == "2026-10-14T11:00:00Z"
    assert meeting["host"] is None
    assert meetings_of(client, team["id"])["meetings"] == [meeting]


def test_a_second_meeting_on_the_same_date(client: TestClient) -> None:
    """Scenario: A second meeting on the same date."""
    team = register(client)
    open_meeting(client, team["id"], "2026-10-14", "13:00")

    response = client.post(
        f"/teams/{team['id']}/meetings", json={"date": "2026-10-14", "time": "17:00"}
    )

    assert response.status_code == 409
    assert error_of(response) == ("date", "meeting_date.taken")
    assert len(meetings_of(client, team["id"])["meetings"]) == 1


def test_two_teams_meet_on_the_same_date(client: TestClient) -> None:
    """Scenario: Two teams meet on the same date."""
    alpha = register(client, "Alpha", "lead.alpha@example.com")
    beta = register(client, "Beta", "lead.beta@example.com")

    open_meeting(client, alpha["id"], "2026-10-14")
    open_meeting(client, beta["id"], "2026-10-14")

    assert len(meetings_of(client, alpha["id"])["meetings"]) == 1
    assert len(meetings_of(client, beta["id"])["meetings"]) == 1


def test_a_meeting_in_the_past(client: TestClient) -> None:
    """Scenario: A meeting in the past."""
    team = register(client)

    meeting = open_meeting(client, team["id"], "2020-01-08", "13:00")

    assert meeting["date"] == "2020-01-08"


def test_date_or_time_is_missing_or_malformed(client: TestClient) -> None:
    """Scenario: Date or time is missing or malformed."""
    team = register(client)
    url = f"/teams/{team['id']}/meetings"

    missing_date = client.post(url, json={"time": "13:00"})
    bad_time = client.post(url, json={"date": "2026-10-14", "time": "25:00"})

    assert (missing_date.status_code, error_of(missing_date)) == (
        422,
        ("date", "request.invalid_field"),
    )
    assert (bad_time.status_code, error_of(bad_time)) == (422, ("time", "request.invalid_field"))
    assert meetings_of(client, team["id"])["meetings"] == []


def test_the_team_does_not_exist(client: TestClient) -> None:
    """Scenario: The team does not exist."""
    response = client.post(
        f"/teams/{uuid.uuid4()}/meetings", json={"date": "2026-10-14", "time": "13:00"}
    )

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
