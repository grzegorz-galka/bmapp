"""Calls the metrics tests share, made through the HTTP API."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

#: A Monday. The week's meeting is on Wednesday the 14th, the last on the 7th.
MONDAY = datetime.date(2026, 10, 12)


def add_metric(client: TestClient, team_id: str, name: str = "Revenue", **fields: Any) -> Any:
    """Add a metric and return it, failing the test if that is refused."""
    body = {"name": name, "direction": "higher_is_better", **fields}
    response = client.post(f"/teams/{team_id}/metrics", json=body)
    assert response.status_code == 201, response.json()
    return response.json()


def metrics_of(client: TestClient, team_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/metrics")
    assert response.status_code == 200, response.json()
    return response.json()


def add_threshold(
    client: TestClient,
    team_id: str,
    metric_id: str,
    effective_from: str = "2026-01-01",
    reason: str = "Plan",
    **bounds: Any,
) -> Any:
    """Add a threshold version and return it, failing the test if that is refused."""
    body = {"effective_from": effective_from, "reason": reason, **bounds}
    response = client.post(f"/teams/{team_id}/metrics/{metric_id}/thresholds", json=body)
    assert response.status_code == 201, response.json()
    return response.json()


def thresholds_of(client: TestClient, team_id: str, metric_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/metrics/{metric_id}/thresholds")
    assert response.status_code == 200, response.json()
    return response.json()


def put_value(
    client: TestClient,
    team_id: str,
    meeting_id: str,
    metric_id: str,
    value: str | None = None,
    manual_status: str | None = None,
    comment: str | None = None,
    **extra: Any,
) -> Any:
    """Record a value; returns the raw response, since many tests expect a refusal."""
    body = {"value": value, "manual_status": manual_status, "comment": comment, **extra}
    return client.put(f"/teams/{team_id}/meetings/{meeting_id}/values/{metric_id}", json=body)


def record(client: TestClient, team_id: str, meeting_id: str, metric_id: str, **fields: Any) -> Any:
    """Record a value and return it, failing the test if that is refused."""
    response = put_value(client, team_id, meeting_id, metric_id, **fields)
    assert response.status_code == 200, response.json()
    return response.json()


def board_of(client: TestClient, team_id: str, meeting_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/meetings/{meeting_id}/board")
    assert response.status_code == 200, response.json()
    return response.json()


def trend_of(client: TestClient, team_id: str, metric_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/metrics/{metric_id}/trend")
    assert response.status_code == 200, response.json()
    return response.json()


def tile(board: Any, metric_id: str) -> Any:
    """The board entry for one metric."""
    return next(entry for entry in board["metrics"] if entry["metric"]["id"] == metric_id)


def freeze_today(monkeypatch: pytest.MonkeyPatch, day: datetime.date = MONDAY) -> None:
    """Make every metrics endpoint believe today is `day` in the organization's zone."""
    for module in ("app.api.metrics", "app.api.metric_values", "app.api.meetings"):
        monkeypatch.setattr(f"{module}.today", lambda: day)


def add_group(client: TestClient, team_id: str, name: str) -> Any:
    """Add a group to a board and return it, failing the test if that is refused."""
    response = client.post(f"/teams/{team_id}/metric-groups", json={"name": name})
    assert response.status_code == 201, response.json()
    return response.json()


def groups_of(client: TestClient, team_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/metric-groups")
    assert response.status_code == 200, response.json()
    return response.json()


def put_layout(
    client: TestClient, team_id: str, groups: list[tuple[str, list[str]]], ungrouped: list[str]
) -> Any:
    """Replace a board's layout; returns the raw response, since some tests expect a refusal."""
    body = {
        "groups": [{"id": group_id, "metric_ids": ids} for group_id, ids in groups],
        "ungrouped": ungrouped,
    }
    return client.put(f"/teams/{team_id}/metric-layout", json=body)


def placement(metric: Any) -> tuple[str | None, int]:
    """Where a metric sits on its board: its group's name, or none, and its position there."""
    return (metric["group"]["name"] if metric["group"] else None, metric["position"])
