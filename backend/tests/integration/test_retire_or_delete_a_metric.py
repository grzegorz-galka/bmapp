"""One test per scenario of "Retire or delete a metric" in specs/metrics/spec.md."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    freeze_today,
    metrics_of,
    put_value,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.teams_api import register


def _metric_with_a_value(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> tuple[dict[str, Any], dict[str, Any]]:
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"])
    add_threshold(client, team["id"], metric["id"], green="95", amber="85")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], metric["id"], value="90")
    return team, metric


def test_a_metric_is_retired(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A metric is retired."""
    team, metric = _metric_with_a_value(client, monkeypatch)

    response = client.patch(f"/teams/{team['id']}/metrics/{metric['id']}", json={"retired": True})

    assert response.json()["retired"] is True
    assert [p["value"] for p in trend_of(client, team["id"], metric["id"])["points"]] == ["90"]
    assert len(thresholds_of(client, team["id"], metric["id"])) == 1


def test_a_retired_metric_is_brought_back(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A retired metric is brought back."""
    team, metric = _metric_with_a_value(client, monkeypatch)
    url = f"/teams/{team['id']}/metrics/{metric['id']}"
    client.patch(url, json={"retired": True})
    meeting_id = trend_of(client, team["id"], metric["id"])["points"][0]["meeting_id"]

    response = client.patch(url, json={"retired": False})

    assert response.json()["retired"] is False
    accepted = put_value(client, team["id"], meeting_id, metric["id"], value="91")
    assert accepted.status_code == 200


def test_a_metric_without_values_is_deleted(client: TestClient) -> None:
    """Scenario: A metric without values is deleted."""
    team = register(client)
    metric = add_metric(client, team["id"], "Revenue")
    add_threshold(client, team["id"], metric["id"], green="1", amber="0")

    response = client.delete(f"/teams/{team['id']}/metrics/{metric['id']}")

    assert response.status_code == 204
    assert metrics_of(client, team["id"]) == []
    add_metric(client, team["id"], "Revenue")


def test_deleting_a_metric_with_values_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Deleting a metric with values is refused."""
    team, metric = _metric_with_a_value(client, monkeypatch)

    response = client.delete(f"/teams/{team['id']}/metrics/{metric['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric.has_values")
    assert [m["id"] for m in metrics_of(client, team["id"])] == [metric["id"]]
