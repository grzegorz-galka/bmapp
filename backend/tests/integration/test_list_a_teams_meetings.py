"""One test per scenario of "List a team's meetings" in specs/meetings/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import (
    dates_of,
    freeze_today,
    meetings_of,
    open_meeting,
    set_schedule,
)
from tests.integration.teams_api import register


def test_meetings_are_returned_in_order(client: TestClient) -> None:
    """Scenario: Meetings are returned in order."""
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    for date in ["2026-10-21", "2026-10-07", "2026-10-14"]:
        open_meeting(client, team["id"], date)
    open_meeting(client, other["id"], "2026-10-10")

    listing = meetings_of(client, team["id"])

    assert dates_of(listing) == ["2026-10-07", "2026-10-14", "2026-10-21"]
    assert {m["team_id"] for m in listing["meetings"]} == {team["id"]}


def test_a_team_with_no_meetings(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A team with no meetings."""
    team = register(client)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))

    listing = meetings_of(client, team["id"])

    assert listing == {
        "schedule": {"weekday": 3, "time": "13:00"},
        "proposed": {"date": "2026-10-14", "time": "13:00"},
        "meetings": [],
    }


def test_the_proposal_skips_a_date_already_taken(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The proposal sees the team's real meetings, not only the schedule."""
    team = register(client)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 14))

    assert meetings_of(client, team["id"])["proposed"] == {"date": "2026-10-21", "time": "13:00"}


def test_no_proposal_without_a_schedule(client: TestClient) -> None:
    team = register(client)

    listing = meetings_of(client, team["id"])

    assert listing["schedule"] is None
    assert listing["proposed"] is None


def test_the_meetings_of_a_missing_team(client: TestClient) -> None:
    response = client.get("/teams/00000000-0000-0000-0000-000000000000/meetings")

    assert response.status_code == 404
