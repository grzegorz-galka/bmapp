"""The API half of "The dashboard shows the viewer's teams" in specs/dashboard/spec.md.

One test per scenario. Today is pinned to Monday 12 October 2026 in the
organization's zone, so the proposed dates are known.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import VIEWER, dashboard_of, freeze_today, team_with
from tests.integration.meetings_api import open_meeting, set_schedule
from tests.integration.teams_api import register

ClientAs = Callable[[str], TestClient]


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def test_teams_are_listed_in_order_of_their_next_meeting(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: Teams are listed in order of their next meeting."""
    proposed = team_with(client, "Alpha", VIEWER)
    set_schedule(client, proposed["id"], weekday=4, time="09:30")
    opened = team_with(client, "Beta", VIEWER)
    open_meeting(client, opened["id"], "2026-10-13", "11:00")
    register(client, "Gamma", VIEWER)

    teams = dashboard_of(client_as(VIEWER))["teams"]

    assert len(teams) == 3
    assert [
        (team["name"], team["initials"], team["role"], team["schedule"], team["next_meeting_at"])
        for team in teams
    ] == [
        ("Beta", "BE", "member", None, "2026-10-13T09:00:00Z"),
        ("Alpha", "AL", "member", {"weekday": 4, "start_time": "09:30"}, "2026-10-15T07:30:00Z"),
        ("Gamma", "GA", "leader", None, None),
    ]


def test_an_opened_meeting_comes_before_the_proposal(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An opened meeting comes before the proposal."""
    team = team_with(client, "Platform", VIEWER)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    thursday = open_meeting(client, team["id"], "2026-10-15", "10:00")

    dashboard = dashboard_of(client_as(VIEWER))

    (listed,) = dashboard["teams"]
    assert listed["next_meeting_at"] == "2026-10-15T08:00:00Z"
    assert [meeting["meeting_id"] for meeting in dashboard["meetings"]] == [thursday["id"]]


def test_a_team_with_no_meeting_and_no_schedule(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A team with no meeting and no schedule."""
    team = team_with(client, "Platform", VIEWER)
    # A meeting before today is no next meeting.
    open_meeting(client, team["id"], "2026-10-05")

    dashboard = dashboard_of(client_as(VIEWER))

    (listed,) = dashboard["teams"]
    assert (listed["schedule"], listed["next_meeting_at"]) == (None, None)
    assert dashboard["meetings"] == []


def test_a_viewer_on_no_team(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A viewer on no team."""
    team = team_with(client, "Platform")
    set_schedule(client, team["id"])

    dashboard = dashboard_of(client_as("nobody@example.com"))

    assert dashboard["teams"] == []
    assert dashboard["meetings"] == []
