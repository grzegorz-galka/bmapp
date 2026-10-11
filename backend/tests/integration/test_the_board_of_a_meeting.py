"""One test per scenario of "The board of a meeting" in specs/metric-values/spec.md."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    board_of,
    freeze_today,
    record,
    tile,
)
from tests.integration.teams_api import register


@pytest.fixture
def two_meetings(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    """A team that met on 7.10 and meets next on 14.10; today is Monday the 12th."""
    freeze_today(monkeypatch)
    team = register(client)
    previous = open_meeting(client, team["id"], "2026-10-07")
    current = open_meeting(client, team["id"], "2026-10-14")
    return team["id"], previous["id"], current["id"]


def _change(
    client: TestClient, meetings: tuple[str, str, str], direction: str, a: str, b: str
) -> Any:
    """Record `a` then `b` for a new metric, and return its tile at the second meeting."""
    team_id, previous, current = meetings
    metric = add_metric(client, team_id, direction=direction)
    record(client, team_id, previous, metric["id"], value=a)
    record(client, team_id, current, metric["id"], value=b)
    return tile(board_of(client, team_id, current), metric["id"])


def test_the_change_since_the_previous_meeting(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    """Scenario: The change since the previous meeting."""
    entry = _change(client, two_meetings, "higher_is_better", "85", "90")

    assert (entry["value"], entry["previous"], entry["change"]) == ("90", "85", "5")
    assert entry["improvement"] is True


def test_lower_is_better_reads_the_change_the_other_way(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    """Scenario: Lower is better reads the change the other way."""
    entry = _change(client, two_meetings, "lower_is_better", "4", "3")

    assert (entry["change"], entry["improvement"]) == ("-1", True)


def test_a_band_metric_has_no_better_direction(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    """Scenario: A band metric has no better direction."""
    entry = _change(client, two_meetings, "within_band", "71.5", "72")

    assert (entry["change"], entry["improvement"]) == ("0.5", None)


def test_a_decline_is_marked_as_such(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    entry = _change(client, two_meetings, "higher_is_better", "90", "85")

    assert (entry["change"], entry["improvement"]) == ("-5", False)


def test_no_number_at_the_previous_meeting(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: No number at the previous meeting."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"])
    earlier = open_meeting(client, team["id"], "2026-09-30")
    previous = open_meeting(client, team["id"], "2026-10-07")
    current = open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 1))
    record(client, team["id"], earlier["id"], metric["id"], value="80")
    freeze_today(monkeypatch)
    record(client, team["id"], previous["id"], metric["id"], manual_status="red", comment="Lost")
    record(client, team["id"], current["id"], metric["id"], value="90")

    entry = tile(board_of(client, team["id"], current["id"]), metric["id"])

    assert (entry["previous"], entry["change"], entry["improvement"]) == (None, None, None)


def test_retired_metrics_are_left_off(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    """Scenario: Retired metrics are left off."""
    team_id, _, current = two_meetings
    active = add_metric(client, team_id, "Active")
    retired = add_metric(client, team_id, "Retired")
    client.patch(f"/teams/{team_id}/metrics/{retired['id']}", json={"retired": True})

    board = board_of(client, team_id, current)

    assert [entry["metric"]["id"] for entry in board["metrics"]] == [active["id"]]


def test_a_tile_carries_its_status_threshold_comment_and_hand_set_colour(
    client: TestClient, two_meetings: tuple[str, str, str]
) -> None:
    team_id, _, current = two_meetings
    metric = add_metric(client, team_id)
    version = add_threshold(client, team_id, metric["id"], green="95", amber="85")
    record(client, team_id, current, metric["id"], value="96", manual_status="red", comment="Q")

    entry = tile(board_of(client, team_id, current), metric["id"])

    assert (entry["status"], entry["set_by_hand"], entry["manual_status"]) == ("red", True, "red")
    assert (entry["comment"], entry["threshold"]["id"]) == ("Q", version["id"])


def test_the_sparkline_spans_the_last_12_meetings_up_to_the_one_shown(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    team = register(client)
    metric = add_metric(client, team["id"])
    add_threshold(client, team["id"], metric["id"], green="10", amber="5")
    start = datetime.date(2026, 7, 1)
    meetings = []
    for week in range(14):
        day = start + datetime.timedelta(weeks=week)
        meeting = open_meeting(client, team["id"], day.isoformat())
        freeze_today(monkeypatch, day)
        record(client, team["id"], meeting["id"], metric["id"], value=str(week))
        meetings.append(meeting)

    entry = tile(board_of(client, team["id"], meetings[-1]["id"]), metric["id"])

    assert [p["value"] for p in entry["sparkline"]] == [str(w) for w in range(2, 14)]
    assert [p["status"] for p in entry["sparkline"]][2:4] == ["red", "amber"]
    assert entry["sparkline"][-1]["meeting_id"] == meetings[-1]["id"]


def _statements(session: Session, call: Any) -> int:
    count = 0

    def counted(*_: Any) -> None:
        nonlocal count
        count += 1

    connection = session.connection()
    event.listen(connection, "before_cursor_execute", counted)
    try:
        call()
    finally:
        event.remove(connection, "before_cursor_execute", counted)
    return count


def test_a_board_of_14_metrics_takes_a_fixed_number_of_statements(
    client: TestClient, session: Session, two_meetings: tuple[str, str, str]
) -> None:
    team_id, previous, current = two_meetings
    first = add_metric(client, team_id, "Metric 0")
    record(client, team_id, current, first["id"], value="1")
    one = _statements(session, lambda: board_of(client, team_id, current))
    for index in range(1, 14):
        metric = add_metric(client, team_id, f"Metric {index}")
        add_threshold(client, team_id, metric["id"], green="95", amber="85")
        record(client, team_id, previous, metric["id"], value="80")
        record(client, team_id, current, metric["id"], value="90")

    fourteen = _statements(session, lambda: board_of(client, team_id, current))

    assert len(board_of(client, team_id, current)["metrics"]) == 14
    # The caller's employee lookup, then the meeting, its team's meeting
    # dates, the metrics, their thresholds and their values.
    assert one == fourteen == 6
