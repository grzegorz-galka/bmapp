"""One test per scenario of "Deactivate and reactivate a project or a product".

In specs/projects-and-products/spec.md.
"""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_a_project_is_deactivated(client: TestClient) -> None:
    """Scenario: A project is deactivated."""
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")

    response = client.patch(f"/teams/{team['id']}/projects/{project['id']}", json={"active": False})

    assert response.status_code == 200, response.json()
    assert response.json()["active"] is False


def test_a_project_is_reactivated(client: TestClient) -> None:
    """Scenario: A project is reactivated."""
    team = register(client)
    project = add_project(client, team["id"])
    url = f"/teams/{team['id']}/projects/{project['id']}"
    client.patch(url, json={"active": False})

    response = client.patch(url, json={"active": True})

    assert response.status_code == 200, response.json()
    assert response.json()["active"] is True


def test_a_product_is_deactivated_and_reactivated(client: TestClient) -> None:
    """The same by hand for a product."""
    team = register(client)
    product = add_product(client, team["id"])
    url = f"/teams/{team['id']}/products/{product['id']}"

    off = client.patch(url, json={"active": False}).json()
    on = client.patch(url, json={"active": True}).json()

    assert (off["active"], on["active"]) == (False, True)


def test_the_end_date_passes(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: The end date passes."""
    team = register(client)
    project = add_project(client, team["id"], start_date="2026-09-01", end_date="2026-10-31")
    monkeypatch.setattr("app.api.projects.today", lambda: datetime.date(2026, 11, 6))

    read = client.get(f"/teams/{team['id']}/projects/{project['id']}").json()

    assert read["active"] is True
    assert read["past_end"] is True
