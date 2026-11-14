"""One test per scenario of "A project's or product's metric is never derived".

In specs/derived-metrics/spec.md. The interface's scenario is tested in
MetricSettingsPage.test.tsx.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Metric
from tests.integration.derivations_api import derivation, set_derivation
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, metrics_of
from tests.integration.project_metrics_api import add_metric_of, post_metric_of
from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_a_derivation_on_a_projects_metric_is_refused(client: TestClient, session: Session) -> None:
    """Scenario: A derivation on a project's metric is refused."""
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")
    source = add_metric(client, team["id"], "Spend")
    existing = add_metric_of(client, team["id"], "Budget consumed", project_id=project["id"])
    body = derivation("sum", (team["id"], source["id"]))

    added = post_metric_of(
        client, team["id"], "Forecast", project_id=project["id"], derivation=body
    )
    changed = set_derivation(client, team["id"], existing["id"], body)

    assert added.status_code == changed.status_code == 409
    assert error_of(added) == ("derivation", "derivation.project_metric")
    assert error_of(changed) == ("derivation", "derivation.project_metric")
    session.expire_all()
    assert session.query(Metric).count() == 2
    listed = {m["id"]: m["derivation"] for m in metrics_of(client, team["id"])}
    assert listed == {source["id"]: None, existing["id"]: None}


def test_a_derivation_on_a_products_metric_is_refused(client: TestClient) -> None:
    """Scenario: A derivation on a product's metric is refused."""
    team = register(client)
    product = add_product(client, team["id"], name="Customer portal")
    source = add_metric(client, team["id"], "Satisfaction")
    nps = add_metric_of(client, team["id"], "NPS", product_id=product["id"])

    response = set_derivation(
        client, team["id"], nps["id"], derivation("mean", (team["id"], source["id"]))
    )

    assert response.status_code == 409
    assert error_of(response) == ("derivation", "derivation.product_metric")


def test_removing_a_derivation_that_is_not_there_is_no_change(client: TestClient) -> None:
    """`derivation: null` on a project's metric repeats what it has, and is accepted."""
    team = register(client)
    project = add_project(client, team["id"])
    metric = add_metric_of(client, team["id"], project_id=project["id"])

    response = set_derivation(client, team["id"], metric["id"], None)

    assert response.status_code == 200, response.json()
    assert response.json()["derivation"] is None
