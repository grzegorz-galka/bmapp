"""One test per scenario of "Record a metric value at a meeting" in specs/metric-values/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    board_of,
    freeze_today,
    put_value,
    record,
    tile,
    trend_of,
)
from tests.integration.teams_api import register


@pytest.fixture
def board(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    """A team, its metric with green from 95 and amber from 85, and its next meeting."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    add_threshold(client, team["id"], metric["id"], green="95", amber="85")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    return team["id"], meeting["id"], metric["id"]


def test_a_value_is_recorded(client: TestClient, board: tuple[str, str, str]) -> None:
    """Scenario: A value is recorded."""
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)

    value = record(client, *board, value="96.2", comment="Ahead of plan")

    assert {k: value[k] for k in ("value", "comment", "status", "recorded_by_email")} == {
        "value": "96.2",
        "comment": "Ahead of plan",
        "status": "green",
        "recorded_by_email": ADMIN_EMAIL,
    }
    assert (value["set_by_hand"], value["manual_status"]) == (False, None)
    assert datetime.datetime.fromisoformat(value["recorded_at"]) >= before


def test_a_value_is_replaced(client: TestClient, board: tuple[str, str, str]) -> None:
    """Scenario: A value is replaced."""
    team_id, meeting_id, metric_id = board
    record(client, *board, value="96.2", comment="Ahead of plan")

    replaced = record(client, *board, value="90")

    assert (replaced["value"], replaced["comment"], replaced["status"]) == ("90", None, "amber")
    points = trend_of(client, team_id, metric_id)["points"]
    assert [(p["meeting_id"], p["value"]) for p in points] == [(meeting_id, "90")]


def test_a_colour_set_by_hand_without_a_comment(
    client: TestClient, board: tuple[str, str, str]
) -> None:
    """Scenario: A colour set by hand without a comment."""
    record(client, *board, value="96")

    response = put_value(client, *board, value="96", manual_status="red", comment="  ")

    assert response.status_code == 422
    assert error_of(response) == ("comment", "metric_value.comment_required")
    assert tile(board_of(client, board[0], board[1]), board[2])["manual_status"] is None


def test_a_colour_set_by_hand_without_a_number(
    client: TestClient, board: tuple[str, str, str]
) -> None:
    """Scenario: A colour set by hand without a number."""
    value = record(client, *board, manual_status="amber", comment="Data late from finance")

    assert (value["value"], value["status"], value["set_by_hand"]) == (None, "amber", True)


def test_a_retired_metric(client: TestClient, board: tuple[str, str, str]) -> None:
    """Scenario: A retired metric."""
    team_id, _, metric_id = board
    client.patch(f"/teams/{team_id}/metrics/{metric_id}", json={"retired": True})

    response = put_value(client, *board, value="96")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric.retired")


def test_metric_and_meeting_of_different_teams(
    client: TestClient, board: tuple[str, str, str]
) -> None:
    """Scenario: Metric and meeting of different teams."""
    team_id, _, metric_id = board
    other = register(client, "Other", "lead.other@example.com")
    theirs = open_meeting(client, other["id"], "2026-10-14")

    for team in (team_id, other["id"]):
        response = put_value(client, team, theirs["id"], metric_id, value="96")

        assert response.status_code == 404
        assert error_of(response)[1] in {"meeting.not_found", "metric.not_found"}
    # Through the metric's own team, the other team's meeting is "not found".
    response = put_value(client, team_id, theirs["id"], metric_id, value="96")
    assert error_of(response) == (None, "meeting.not_found")


@pytest.mark.parametrize("value", ["1000000000000000", "-1000000000000000", "1.0000001"])
def test_a_number_out_of_range(client: TestClient, board: tuple[str, str, str], value: str) -> None:
    """Scenario: A number out of range."""
    response = put_value(client, *board, value=value)

    assert response.status_code == 422
    assert error_of(response) == ("value", "metric_value.out_of_range")


def test_clearing_every_property_removes_the_entry(
    client: TestClient, board: tuple[str, str, str]
) -> None:
    team_id, meeting_id, _ = board
    record(client, *board, value="96")

    cleared = record(client, *board)

    assert (cleared["status"], cleared["recorded_by_email"]) == ("no_data", None)
    # Nothing is recorded, so the meeting may be deleted again.
    assert client.delete(f"/teams/{team_id}/meetings/{meeting_id}").status_code == 204


def test_a_value_has_no_threshold_before_the_first_version(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    value = record(client, team["id"], meeting["id"], metric["id"], value="50")

    assert value["status"] == "no_threshold"
