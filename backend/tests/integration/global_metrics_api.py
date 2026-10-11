"""Calls the global metric tests share, made through the HTTP API or, for inclusion, the session."""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import BoardMetric


def add_global(client: TestClient, name: str = "Service availability", **fields: Any) -> Any:
    """Add a global metric and return it, failing the test if that is refused."""
    body = {"name": name, "direction": "higher_is_better", **fields}
    response = client.post("/global-metrics", json=body)
    assert response.status_code == 201, response.json()
    return response.json()


def catalogue(client: TestClient) -> Any:
    response = client.get("/global-metrics")
    assert response.status_code == 200, response.json()
    return response.json()


def global_thresholds_of(client: TestClient, metric_id: str) -> Any:
    response = client.get(f"/global-metrics/{metric_id}/thresholds")
    assert response.status_code == 200, response.json()
    return response.json()


def add_global_threshold(
    client: TestClient,
    metric_id: str,
    effective_from: str = "2026-01-01",
    reason: str = "Plan",
    **bounds: Any,
) -> Any:
    """Add a threshold version to a global metric, failing the test if that is refused."""
    body = {"effective_from": effective_from, "reason": reason, **bounds}
    response = client.post(f"/global-metrics/{metric_id}/thresholds", json=body)
    assert response.status_code == 201, response.json()
    return response.json()


def include(session: Session, team_id: str, metric_id: str, position: int = 0) -> None:
    """Include a global metric in a board, directly in the database.

    The inclusion endpoint belongs to another requirement; these tests need
    only the placement it would create.
    """
    session.add(
        BoardMetric(team_id=uuid.UUID(team_id), metric_id=uuid.UUID(metric_id), position=position)
    )
    session.commit()
