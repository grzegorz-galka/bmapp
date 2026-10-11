"""One test per scenario of "An administrator corrects a frozen value"
in specs/metric-values/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    put_value,
    record,
    tile,
    trend_of,
)
from tests.integration.teams_api import register


@pytest.fixture
def frozen(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    """A value of 12 recorded on 7.10, frozen once the team met again on 14.10."""
    team = register(client)
    metric = add_metric(client, team["id"])
    old = open_meeting(client, team["id"], "2026-10-07")
    open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    record(client, team["id"], old["id"], metric["id"], value="12")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))
    return team["id"], old["id"], metric["id"]


def test_a_frozen_value_is_corrected(client: TestClient, frozen: tuple[str, str, str]) -> None:
    """Scenario: A frozen value is corrected."""
    team_id, meeting_id, metric_id = frozen
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)

    response = put_value(client, *frozen, value="13", reason="Late invoice booked")

    assert response.status_code == 200
    assert response.json()["value"] == "13"
    [correction] = trend_of(client, team_id, metric_id)["corrections"]
    assert {
        k: correction[k]
        for k in ("meeting_id", "old_value", "new_value", "reason", "corrected_by_email")
    } == {
        "meeting_id": meeting_id,
        "old_value": "12",
        "new_value": "13",
        "reason": "Late invoice booked",
        "corrected_by_email": ADMIN_EMAIL,
    }
    assert datetime.datetime.fromisoformat(correction["corrected_at"]) >= before


def test_a_correction_without_a_reason(client: TestClient, frozen: tuple[str, str, str]) -> None:
    """Scenario: A correction without a reason."""
    team_id, meeting_id, metric_id = frozen

    for reason in (None, "   "):
        response = put_value(client, *frozen, value="13", reason=reason)

        assert response.status_code == 422
        assert error_of(response) == ("reason", "metric_value_reason.blank")
    assert tile(board_of(client, team_id, meeting_id), metric_id)["value"] == "12"
    assert trend_of(client, team_id, metric_id)["corrections"] == []


def test_an_edit_inside_the_window_is_not_logged_as_a_correction(
    client: TestClient, frozen: tuple[str, str, str]
) -> None:
    """Scenario: An edit inside the window is not logged as a correction."""
    team_id, _, metric_id = frozen
    latest = trend_of(client, team_id, metric_id)["points"][-1]["meeting_id"]

    record(client, team_id, latest, metric_id, value="14", reason="Not needed")
    record(client, team_id, latest, metric_id, value="15")

    assert trend_of(client, team_id, metric_id)["corrections"] == []
