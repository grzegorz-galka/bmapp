"""One test per scenario of "A project's or product's metric name is unique within it".

In specs/projects-and-products/spec.md.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, metrics_of
from tests.integration.project_metrics_api import add_metric_of, post_metric_of
from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_two_projects_measure_the_same_thing(client: TestClient) -> None:
    """Scenario: Two projects measure the same thing."""
    team = register(client)
    first = add_project(client, team["id"], code="PRJ-042")
    second = add_project(client, team["id"], code="PRJ-050")

    add_metric_of(client, team["id"], "Budget consumed", project_id=first["id"])
    add_metric_of(client, team["id"], "Budget consumed", project_id=second["id"])
    add_metric(client, team["id"], "Budget consumed")

    labels = sorted(
        ((m["project"] or {}).get("code", ""), m["name"]) for m in metrics_of(client, team["id"])
    )
    assert labels == [
        ("", "Budget consumed"),
        ("PRJ-042", "Budget consumed"),
        ("PRJ-050", "Budget consumed"),
    ]


def test_the_name_is_taken_in_the_project(client: TestClient) -> None:
    """Scenario: The name is taken in the project."""
    team = register(client)
    project = add_project(client, team["id"])
    product = add_product(client, team["id"])
    add_metric_of(client, team["id"], "Budget consumed", project_id=project["id"])
    add_metric_of(client, team["id"], "NPS", product_id=product["id"])

    in_project = post_metric_of(client, team["id"], "budget consumed", project_id=project["id"])
    in_product = post_metric_of(client, team["id"], "nps", product_id=product["id"])

    assert in_project.status_code == in_product.status_code == 409
    assert error_of(in_project) == ("name", "metric_name.duplicate")
    assert error_of(in_product) == ("name", "metric_name.duplicate")
    assert len(metrics_of(client, team["id"])) == 2


def test_a_rename_within_the_project_is_refused(client: TestClient) -> None:
    """Renaming a project's metric onto another of the same project's names is refused."""
    team = register(client)
    project = add_project(client, team["id"])
    add_metric_of(client, team["id"], "Budget consumed", project_id=project["id"])
    scope = add_metric_of(client, team["id"], "Scope change", project_id=project["id"])
    add_metric(client, team["id"], "Lead time")

    clash = client.patch(
        f"/teams/{team['id']}/metrics/{scope['id']}", json={"name": "BUDGET CONSUMED"}
    )
    free = client.patch(f"/teams/{team['id']}/metrics/{scope['id']}", json={"name": "Lead time"})

    assert clash.status_code == 409
    assert error_of(clash) == ("name", "metric_name.duplicate")
    assert free.status_code == 200, free.json()


def test_a_global_metric_may_share_a_projects_metric_name(
    client: TestClient, session: Session
) -> None:
    """Including a global metric whose name a project's metric uses is allowed."""
    team = register(client)
    project = add_project(client, team["id"])
    add_metric_of(client, team["id"], "Availability", project_id=project["id"])
    availability = seed_global_metric(session, "Availability")

    include(client, team["id"], availability)

    assert sorted(m["scope"] for m in metrics_of(client, team["id"])) == ["board", "global"]
