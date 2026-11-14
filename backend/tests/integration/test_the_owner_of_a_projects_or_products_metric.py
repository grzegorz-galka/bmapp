"""One test per scenario of "The owner of a project's or product's metric".

In specs/projects-and-products/spec.md.
"""

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.project_metrics_api import add_metric_of, post_metric_of
from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import add, member_id, register

pytestmark = pytest.mark.integration

ANNA = "anna@example.com"
JAN = "jan@example.com"


def test_the_manager_is_a_member(client: TestClient) -> None:
    """Scenario: The manager is a member."""
    team = add(client, register(client)["id"], ANNA)
    project = add_project(client, team["id"], manager_email=ANNA)

    metric = add_metric_of(client, team["id"], project_id=project["id"])

    assert metric["owner"]["id"] == member_id(team, ANNA)
    assert metric["owner"]["email"] == ANNA


def test_the_manager_is_not_a_member(client: TestClient) -> None:
    """Scenario: The manager is not a member."""
    team = register(client)
    project = add_project(client, team["id"], manager_email=ANNA)

    metric = add_metric_of(client, team["id"], project_id=project["id"])

    assert metric["owner"] is None


def test_another_member_is_named(client: TestClient) -> None:
    """Scenario: Another member is named."""
    team = register(client)
    add(client, team["id"], JAN)
    team = add(client, team["id"], ANNA)
    product = add_product(client, team["id"], owner_email=JAN)

    metric = add_metric_of(
        client, team["id"], "NPS", product_id=product["id"], owner_employee_id=member_id(team, ANNA)
    )

    assert metric["owner"]["email"] == ANNA


def test_a_named_owner_follows_the_rule_for_any_metric(client: TestClient) -> None:
    """An owner given for a product's metric must be a member, as for any metric."""
    team = register(client)
    other = add(client, register(client, "Quality", "quality-lead@example.com")["id"], ANNA)
    product = add_product(client, team["id"], owner_email=ANNA)

    response = post_metric_of(
        client,
        team["id"],
        "NPS",
        product_id=product["id"],
        owner_employee_id=member_id(other, ANNA),
    )

    assert response.status_code == 409
    assert error_of(response) == ("owner_employee_id", "metric_owner.not_member")
