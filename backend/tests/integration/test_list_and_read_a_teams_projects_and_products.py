"""One test per scenario of "List and read a team's projects and products".

In specs/projects-and-products/spec.md.
"""

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.projects_api import add_product, add_project, products_of, projects_of
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_projects_are_listed_by_code(client: TestClient) -> None:
    """Scenario: Projects are listed by code."""
    team = register(client)
    later = add_project(client, team["id"], code="PRJ-050", name="Later")
    add_project(client, team["id"], code="PRJ-042")
    client.patch(f"/teams/{team['id']}/projects/{later['id']}", json={"active": False})

    listed = projects_of(client, team["id"])

    assert [(p["code"], p["active"]) for p in listed] == [("PRJ-042", True), ("PRJ-050", False)]
    assert listed[1]["manager"]["display_name"] == "Anna"
    assert listed[1]["past_end"] is False


def test_products_are_listed_by_name(client: TestClient) -> None:
    """Products come in name order, regardless of case, inactive ones included."""
    team = register(client)
    add_product(client, team["id"], name="customer portal")
    add_product(client, team["id"], name="Billing")

    assert [p["name"] for p in products_of(client, team["id"])] == ["Billing", "customer portal"]


def test_a_project_of_another_team(client: TestClient) -> None:
    """Scenario: A project of another team."""
    platform = register(client, "Platform")
    quality = register(client, "Quality", "quality-lead@example.com")
    project = add_project(client, platform["id"])

    response = client.get(f"/teams/{quality['id']}/projects/{project['id']}")

    assert response.status_code == 404
    assert error_of(response) == ("project_id", "project.not_found")


def test_a_product_of_another_team(client: TestClient) -> None:
    """A product under a team that does not own it is not found either."""
    platform = register(client, "Platform")
    quality = register(client, "Quality", "quality-lead@example.com")
    product = add_product(client, platform["id"])

    response = client.get(f"/teams/{quality['id']}/products/{product['id']}")

    assert (response.status_code, error_of(response)) == (404, ("product_id", "product.not_found"))


def test_the_list_of_an_unknown_team(client: TestClient) -> None:
    """A team that does not exist has no list to return."""
    unknown = "00000000-0000-0000-0000-000000000000"

    for kind in ("projects", "products"):
        response = client.get(f"/teams/{unknown}/{kind}")
        assert (response.status_code, error_of(response)) == (404, (None, "team.not_found"))
