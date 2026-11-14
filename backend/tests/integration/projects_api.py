"""Calls the projects and products tests share, made through the HTTP API, and two seeds."""

import uuid
from decimal import Decimal
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.metric_enums import Direction
from app.models import BoardMetric, Metric, MetricValue

PROJECT = {
    "code": "PRJ-042",
    "name": "Billing rewrite",
    "manager_email": "anna@example.com",
    "start_date": "2026-09-01",
    "end_date": "2027-03-31",
}
PRODUCT = {
    "name": "Customer portal",
    "owner_email": "jan@example.com",
    "jira_url": "https://jira.example.com/secure/RapidBoard.jspa?rapidView=17",
}


def post_project(client: TestClient, team_id: str, **fields: Any) -> Any:
    """Add a project; returns the raw response, since many tests expect a refusal."""
    return client.post(f"/teams/{team_id}/projects", json={**PROJECT, **fields})


def add_project(client: TestClient, team_id: str, **fields: Any) -> Any:
    """Add a project and return it, failing the test if that is refused."""
    response = post_project(client, team_id, **fields)
    assert response.status_code == 201, response.json()
    return response.json()


def post_product(client: TestClient, team_id: str, **fields: Any) -> Any:
    """Add a product; returns the raw response."""
    return client.post(f"/teams/{team_id}/products", json={**PRODUCT, **fields})


def add_product(client: TestClient, team_id: str, **fields: Any) -> Any:
    """Add a product and return it, failing the test if that is refused."""
    response = post_product(client, team_id, **fields)
    assert response.status_code == 201, response.json()
    return response.json()


def projects_of(client: TestClient, team_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/projects")
    assert response.status_code == 200, response.json()
    return response.json()


def products_of(client: TestClient, team_id: str) -> Any:
    response = client.get(f"/teams/{team_id}/products")
    assert response.status_code == 200, response.json()
    return response.json()


def seed_metric(
    session: Session,
    team_id: str,
    name: str = "Budget consumed",
    *,
    project_id: str | None = None,
    product_id: str | None = None,
) -> str:
    """Put a metric of a project or a product on its team's board, through the model.

    Independent of the metric endpoints, so these tests say only what they
    are about; the endpoints that add such a metric have tests of their own.
    """
    metric = Metric(
        team_id=uuid.UUID(team_id),
        project_id=uuid.UUID(project_id) if project_id else None,
        product_id=uuid.UUID(product_id) if product_id else None,
        name=name,
        unit="%",
        decimals=0,
        direction=Direction.LOWER_IS_BETTER,
    )
    session.add(BoardMetric(team_id=uuid.UUID(team_id), metric=metric, hidden=True))
    session.commit()
    return str(metric.id)


def seed_value(session: Session, metric_id: str, meeting_id: str, value: str = "40") -> None:
    """Record a value through the model, as if a member had typed it in."""
    session.add(
        MetricValue(
            metric_id=uuid.UUID(metric_id),
            meeting_id=uuid.UUID(meeting_id),
            value=Decimal(value),
            recorded_by_email="lead@example.com",
        )
    )
    session.commit()
