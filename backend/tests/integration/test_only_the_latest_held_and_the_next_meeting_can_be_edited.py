"""One test per scenario of "Only the latest held and the next meeting can be edited"
in specs/metric-values/spec.md, through the API with today fixed."""

import datetime
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, put_value, tile
from tests.integration.teams_api import add, register

MEMBER = "member@example.com"


Team = tuple[str, str, dict[str, str]]
ClientAs = Callable[[str], TestClient]


@pytest.fixture
def team(client: TestClient) -> Team:
    """A team with a member and a metric, and weekly Wednesday meetings 30.09 to 21.10."""
    team = register(client)
    add(client, team["id"], MEMBER)
    metric = add_metric(client, team["id"])
    meetings = {
        date: open_meeting(client, team["id"], date)["id"]
        for date in ("2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21")
    }
    return team["id"], metric["id"], meetings


def _record(member: TestClient, team: Team, date: str, value: str) -> Any:
    team_id, metric_id, meetings = team
    return put_value(member, team_id, meetings[date], metric_id, value=value)


def test_values_are_typed_in_before_the_meeting(
    client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Values are typed in before the meeting."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    member = client_as(MEMBER)

    statuses = [_record(member, team, d, "1").status_code for d in ("2026-10-07", "2026-10-14")]

    assert statuses == [200, 200]


def test_a_correction_the_day_after(
    client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A correction the day after."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))

    response = _record(client_as(MEMBER), team, "2026-10-14", "1")

    assert response.status_code == 200


def test_an_older_meeting_is_frozen(
    client: TestClient, client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An older meeting is frozen."""
    team_id, metric_id, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    _record(client_as(MEMBER), team, "2026-10-07", "12")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))

    response = _record(client_as(MEMBER), team, "2026-10-07", "13")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric_value.meeting_frozen")
    assert tile(board_of(client, team_id, meetings["2026-10-07"]), metric_id)["value"] == "12"


def test_meetings_prepared_further_ahead_are_frozen_until_their_turn(
    client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Meetings prepared further ahead are frozen until their turn."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))

    response = _record(client_as(MEMBER), team, "2026-10-21", "1")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric_value.meeting_frozen")


def test_the_board_says_whether_its_meeting_can_be_edited(
    client: TestClient, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    team_id, _, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))

    editable = {d: board_of(client, team_id, m)["editable"] for d, m in meetings.items()}

    assert editable == {
        "2026-09-30": False,
        "2026-10-07": True,
        "2026-10-14": True,
        "2026-10-21": False,
    }
