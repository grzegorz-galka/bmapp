"""One test per scenario of "Delete a project or a product".

In specs/projects-and-products/spec.md.
"""

import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import BoardMetric, Metric, MetricThreshold
from tests.integration.derivations_api import derived_metric
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import freeze_today
from tests.integration.projects_api import (
    add_product,
    add_project,
    projects_of,
    seed_metric,
    seed_value,
)
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def _threshold(session: Session, metric_id: str) -> None:
    session.add(
        MetricThreshold(
            metric_id=uuid.UUID(metric_id),
            effective_from=datetime.date(2026, 9, 1),
            target_value=0,
            green_hi=100,
            amber_hi=110,
            reason="Plan",
            recorded_by_email="lead@example.com",
        )
    )
    session.commit()


def test_a_project_without_values_is_deleted(client: TestClient, session: Session) -> None:
    """Scenario: A project without values is deleted."""
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")
    budget = seed_metric(session, team["id"], "Budget consumed", project_id=project["id"])
    seed_metric(session, team["id"], "Scope change", project_id=project["id"])
    _threshold(session, budget)

    response = client.delete(f"/teams/{team['id']}/projects/{project['id']}")

    assert response.status_code == 204
    assert projects_of(client, team["id"]) == []
    gone = client.get(f"/teams/{team['id']}/projects/{project['id']}")
    assert (gone.status_code, error_of(gone)) == (404, ("project_id", "project.not_found"))
    session.expire_all()
    assert session.query(Metric).count() == 0
    assert session.query(BoardMetric).count() == 0
    assert session.query(MetricThreshold).count() == 0
    assert client.get(f"/teams/{team['id']}/metrics").json() == []
    add_project(client, team["id"], code="PRJ-042")


def test_deleting_a_project_with_values_is_refused(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Deleting a project with values is refused."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    project = add_project(client, team["id"])
    budget = seed_metric(session, team["id"], "Budget consumed", project_id=project["id"])
    seed_metric(session, team["id"], "Scope change", project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    seed_value(session, budget, meeting["id"])

    response = client.delete(f"/teams/{team['id']}/projects/{project['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "project.has_values")
    assert [p["id"] for p in projects_of(client, team["id"])] == [project["id"]]
    session.expire_all()
    assert session.query(Metric).count() == 2


def test_deleting_a_product_with_values_is_refused(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Deleting a product with values is refused."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    product = add_product(client, team["id"])
    nps = seed_metric(session, team["id"], "NPS", product_id=product["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    seed_value(session, nps, meeting["id"])

    response = client.delete(f"/teams/{team['id']}/products/{product['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "product.has_values")


def test_a_product_without_values_is_deleted(client: TestClient, session: Session) -> None:
    """A product is deleted with its metrics while none of them has a value."""
    team = register(client)
    product = add_product(client, team["id"])
    seed_metric(session, team["id"], "NPS", product_id=product["id"])

    response = client.delete(f"/teams/{team['id']}/products/{product['id']}")

    assert response.status_code == 204
    gone = client.get(f"/teams/{team['id']}/products/{product['id']}")
    assert (gone.status_code, error_of(gone)) == (404, ("product_id", "product.not_found"))
    session.expire_all()
    assert session.query(Metric).count() == 0


def test_deleting_a_project_whose_metric_is_a_source_is_refused(
    client: TestClient, session: Session
) -> None:
    """Scenario: Deleting a project whose metric is a source is refused."""
    team = register(client, "CKI-P")
    board = register(client, "Zarząd", "zarzad-lead@example.com")
    project = add_project(client, team["id"])
    product = add_product(client, team["id"])
    budget = seed_metric(session, team["id"], "Budget consumed", project_id=project["id"])
    nps = seed_metric(session, team["id"], "NPS", product_id=product["id"])
    derived_metric(client, board["id"], "Budget (all)", "sum", (team["id"], budget))
    derived_metric(client, board["id"], "NPS (all)", "mean", (team["id"], nps))

    project_response = client.delete(f"/teams/{team['id']}/projects/{project['id']}")
    product_response = client.delete(f"/teams/{team['id']}/products/{product['id']}")

    assert project_response.status_code == product_response.status_code == 409
    assert error_of(project_response) == (None, "metric.derivation_source")
    assert error_of(product_response) == (None, "metric.derivation_source")
    assert [p["id"] for p in projects_of(client, team["id"])] == [project["id"]]
    session.expire_all()
    assert session.query(Metric).count() == 4
