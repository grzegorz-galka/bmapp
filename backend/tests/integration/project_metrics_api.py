"""Calls the tests of a project's or product's metrics share, made through the HTTP API."""

from typing import Any

from fastapi.testclient import TestClient


def post_metric_of(
    client: TestClient,
    team_id: str,
    name: str = "Budget consumed",
    *,
    project_id: str | None = None,
    product_id: str | None = None,
    **fields: Any,
) -> Any:
    """Add a metric to a project or a product; returns the raw response."""
    body: dict[str, Any] = {"name": name, "unit": "%", "direction": "lower_is_better", **fields}
    if project_id is not None:
        body["project_id"] = project_id
    if product_id is not None:
        body["product_id"] = product_id
    return client.post(f"/teams/{team_id}/metrics", json=body)


def add_metric_of(
    client: TestClient,
    team_id: str,
    name: str = "Budget consumed",
    *,
    project_id: str | None = None,
    product_id: str | None = None,
    **fields: Any,
) -> Any:
    """Add a metric to a project or a product and return it, failing the test if refused."""
    response = post_metric_of(
        client, team_id, name, project_id=project_id, product_id=product_id, **fields
    )
    assert response.status_code == 201, response.json()
    return response.json()


def set_active(client: TestClient, team_id: str, kind: str, parent_id: str, active: bool) -> Any:
    """Deactivate or reactivate a project (`kind` "projects") or a product ("products")."""
    response = client.patch(f"/teams/{team_id}/{kind}/{parent_id}", json={"active": active})
    assert response.status_code == 200, response.json()
    return response.json()


def change_metric(client: TestClient, team_id: str, metric_id: str, **fields: Any) -> Any:
    """Change a metric and return it, failing the test if that is refused."""
    response = client.patch(f"/teams/{team_id}/metrics/{metric_id}", json=fields)
    assert response.status_code == 200, response.json()
    return response.json()
