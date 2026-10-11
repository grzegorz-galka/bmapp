"""One test per scenario of "Record a threshold version" in specs/metrics/spec.md."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    board_of,
    freeze_today,
    record,
    thresholds_of,
    tile,
)
from tests.integration.teams_api import register


def _post(client: TestClient, team_id: str, metric_id: str, **body: object) -> Any:
    return client.post(
        f"/teams/{team_id}/metrics/{metric_id}/thresholds",
        json={"effective_from": "2026-10-01", "reason": "Plan for Q4", **body},
    )


def test_a_threshold_version_is_recorded(client: TestClient) -> None:
    """Scenario: A threshold version is recorded."""
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    before = datetime.datetime.now(datetime.UTC)

    response = _post(client, team["id"], metric["id"], green="95", amber="85")

    assert response.status_code == 201
    version = response.json()
    assert {k: version[k] for k in ("effective_from", "green_lo", "amber_lo", "reason")} == {
        "effective_from": "2026-10-01",
        "green_lo": "95",
        "amber_lo": "85",
        "reason": "Plan for Q4",
    }
    assert (version["green_hi"], version["amber_hi"]) == (None, None)
    assert version["recorded_by_email"] == ADMIN_EMAIL
    assert datetime.datetime.fromisoformat(version["recorded_at"]) >= before - datetime.timedelta(
        seconds=5
    )


@pytest.mark.parametrize(
    ("direction", "bounds"),
    [
        ("higher_is_better", {"green": "85", "amber": "95"}),
        ("lower_is_better", {"green": "10", "amber": "5"}),
        (
            "within_band",
            {"green_lo": "70", "green_hi": "73", "amber_lo": "71", "amber_hi": "72"},
        ),
    ],
)
def test_boundaries_in_the_wrong_order(
    client: TestClient, direction: str, bounds: dict[str, str]
) -> None:
    """Scenario: Boundaries in the wrong order."""
    team = register(client)
    metric = add_metric(client, team["id"], direction=direction)

    response = _post(client, team["id"], metric["id"], **bounds)

    assert response.status_code == 422
    assert error_of(response) == (None, "threshold.order_invalid")
    assert thresholds_of(client, team["id"], metric["id"]) == []


def test_a_plain_red_and_green_metric(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A plain red-and-green metric."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = _post(client, team["id"], metric["id"], green="90", amber="90")

    assert response.status_code == 201
    statuses = [
        record(client, team["id"], meeting["id"], metric["id"], value=value)["status"]
        for value in ("90", "89.999999", "95")
    ]
    assert statuses == ["green", "red", "green"]


def test_missing_reason(client: TestClient) -> None:
    """Scenario: Missing reason."""
    team = register(client)
    metric = add_metric(client, team["id"])

    response = _post(client, team["id"], metric["id"], green="95", amber="85", reason=" ")

    assert response.status_code == 422
    assert error_of(response) == ("reason", "threshold_reason.blank")


@pytest.mark.parametrize(
    ("direction", "bounds", "field"),
    [
        ("within_band", {"green_lo": "71", "amber_lo": "70"}, "green_hi"),
        (
            "higher_is_better",
            {"green": "95", "amber": "85", "green_hi": "99", "amber_hi": "100"},
            "green_hi",
        ),
    ],
)
def test_boundaries_that_do_not_fit_the_direction(
    client: TestClient, direction: str, bounds: dict[str, str], field: str
) -> None:
    """Scenario: Boundaries that do not fit the direction."""
    team = register(client)
    metric = add_metric(client, team["id"], direction=direction)

    response = _post(client, team["id"], metric["id"], **bounds)

    assert response.status_code == 422
    assert error_of(response) == (field, "request.invalid_field")


def test_a_back_dated_version(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A back-dated version."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    add_threshold(client, team["id"], metric["id"], "2026-07-01", green="95", amber="85")
    meeting = open_meeting(client, team["id"], "2026-10-07")
    record(client, team["id"], meeting["id"], metric["id"], value="90")
    assert tile(board_of(client, team["id"], meeting["id"]), metric["id"])["status"] == "amber"

    response = _post(
        client, team["id"], metric["id"], effective_from="2026-09-01", green="90", amber="80"
    )

    assert response.status_code == 201
    judged = tile(board_of(client, team["id"], meeting["id"]), metric["id"])
    assert (judged["status"], judged["threshold"]["id"]) == ("green", response.json()["id"])


def test_the_metric_does_not_exist(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    theirs = add_metric(client, register(client, "Beta", "lead.beta@example.com")["id"])

    response = _post(client, team["id"], theirs["id"], green="1", amber="0")

    assert response.status_code == 404
    assert error_of(response) == (None, "metric.not_found")
