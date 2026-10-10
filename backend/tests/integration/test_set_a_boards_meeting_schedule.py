"""One test per scenario of "Set a board's meeting schedule" in specs/team-board/spec.md."""

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting, set_schedule
from tests.integration.teams_api import register


def test_a_schedule_is_set(client: TestClient) -> None:
    """Scenario: A schedule is set."""
    team = register(client)

    body = set_schedule(client, team["id"], weekday=3, time="13:00")

    assert body["id"] == team["id"]
    assert body["board"]["schedule"] == {"weekday": 3, "time": "13:00"}


def test_a_schedule_is_replaced(client: TestClient) -> None:
    """Scenario: A schedule is replaced."""
    team = register(client)
    set_schedule(client, team["id"], weekday=3, time="13:00")

    body = set_schedule(client, team["id"], weekday=2, time="09:30")

    assert body["board"]["schedule"] == {"weekday": 2, "time": "09:30"}
    [listed] = client.get("/teams").json()
    assert listed["board"]["schedule"] == {"weekday": 2, "time": "09:30"}


def test_weekday_out_of_range(client: TestClient) -> None:
    """Scenario: Weekday out of range."""
    team = register(client)
    set_schedule(client, team["id"], weekday=3)

    for weekday in (0, 8):
        response = client.put(
            f"/teams/{team['id']}/schedule", json={"weekday": weekday, "time": "13:00"}
        )

        assert response.status_code == 422
        assert error_of(response) == ("weekday", "schedule_weekday.out_of_range")
    assert meetings_of(client, team["id"])["schedule"] == {"weekday": 3, "time": "13:00"}


def test_weekday_or_time_missing_or_malformed(client: TestClient) -> None:
    """Scenario: Weekday or time missing or malformed."""
    team = register(client)

    missing = client.put(f"/teams/{team['id']}/schedule", json={"time": "13:00"})
    malformed = client.put(f"/teams/{team['id']}/schedule", json={"weekday": 3, "time": "25:00"})

    assert error_of(missing) == ("weekday", "request.invalid_field")
    assert error_of(malformed) == ("time", "request.invalid_field")
    assert meetings_of(client, team["id"])["schedule"] is None


def test_setting_a_schedule_leaves_existing_meetings_alone(client: TestClient) -> None:
    """Scenario: Setting a schedule leaves existing meetings alone."""
    team = register(client)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    opened = open_meeting(client, team["id"], "2026-10-14", "13:00")

    set_schedule(client, team["id"], weekday=2, time="09:30")

    [meeting] = meetings_of(client, team["id"])["meetings"]
    assert (meeting["date"], meeting["time"]) == ("2026-10-14", "13:00")
    assert meeting["id"] == opened["id"]


def test_the_schedule_of_a_missing_team(client: TestClient) -> None:
    response = client.put(
        "/teams/00000000-0000-0000-0000-000000000000/schedule",
        json={"weekday": 3, "time": "13:00"},
    )

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
