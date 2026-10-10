"""One test per scenario of "Meeting dates and times are local to the organization"."""

from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.teams_api import register


def test_a_start_time_stays_put_across_the_change_of_clocks(client: TestClient) -> None:
    """Scenario: A start time stays put across the change of clocks."""
    team = register(client)

    summer = open_meeting(client, team["id"], "2026-10-21", "13:00")
    winter = open_meeting(client, team["id"], "2026-10-28", "13:00")

    assert summer["time"] == winter["time"] == "13:00"
    assert summer["starts_at"] == "2026-10-21T11:00:00Z"
    assert winter["starts_at"] == "2026-10-28T12:00:00Z"


def test_a_late_evening_meeting_stays_on_its_own_date(client: TestClient) -> None:
    """Its UTC instant falls on the same day, but one past midnight would not."""
    team = register(client)

    late = open_meeting(client, team["id"], "2026-06-01", "00:30")
    response = client.post(
        f"/teams/{team['id']}/meetings", json={"date": "2026-05-31", "time": "23:30"}
    )

    assert late["starts_at"] == "2026-05-31T22:30:00Z"
    assert late["date"] == "2026-06-01"
    assert response.status_code == 201
