"""One test per scenario of "A metric's trend" in specs/metric-values/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    freeze_today,
    record,
    trend_of,
)
from tests.integration.teams_api import register


def test_a_trend_spans_a_threshold_change(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A trend spans a threshold change."""
    team = register(client)
    metric = add_metric(client, team["id"])
    july = add_threshold(client, team["id"], metric["id"], "2026-07-01", green="90", amber="80")
    september = add_threshold(
        client, team["id"], metric["id"], "2026-09-01", green="95", amber="85"
    )
    for day in ("2026-08-26", "2026-09-02"):
        meeting = open_meeting(client, team["id"], day)
        freeze_today(monkeypatch, datetime.date.fromisoformat(day))
        record(client, team["id"], meeting["id"], metric["id"], value="91")

    points = trend_of(client, team["id"], metric["id"])["points"]

    assert [(p["date"], p["threshold"]["id"], p["status"]) for p in points] == [
        ("2026-08-26", july["id"], "green"),
        ("2026-09-02", september["id"], "amber"),
    ]


def test_skipped_meetings_leave_no_gap(client: TestClient) -> None:
    """Scenario: Skipped meetings leave no gap."""
    team = register(client)
    metric = add_metric(client, team["id"])
    for day in ("2026-09-30", "2026-10-14", "2026-10-21"):
        open_meeting(client, team["id"], day)

    points = trend_of(client, team["id"], metric["id"])["points"]

    assert [p["date"] for p in points] == ["2026-09-30", "2026-10-14", "2026-10-21"]
    assert [(p["value"], p["status"], p["threshold"]) for p in points] == [
        (None, "no_data", None)
    ] * 3


def test_the_metric_does_not_exist(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    theirs = add_metric(client, register(client, "Beta", "lead.beta@example.com")["id"])

    response = client.get(f"/teams/{team['id']}/metrics/{theirs['id']}/trend")

    assert response.status_code == 404
    assert error_of(response) == (None, "metric.not_found")
