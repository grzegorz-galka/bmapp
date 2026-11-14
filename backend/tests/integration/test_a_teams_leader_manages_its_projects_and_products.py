"""Requirement: A team's leader manages its projects and products.

One test per scenario in specs/authorization/spec.md. Every actor but the
fixture's administrator is someone who is not an administrator.
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Metric, Product, Project
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import freeze_today, record, trend_of
from tests.integration.project_metrics_api import add_metric_of
from tests.integration.projects_api import (
    PROJECT,
    add_product,
    add_project,
    post_project,
    products_of,
    projects_of,
)
from tests.integration.teams_api import LEADER_EMAIL, add, appoint, member_id, register

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]

DEPUTY = "deputy@pse.pl"
MEMBER = "member@pse.pl"
STRANGER = "stranger@pse.pl"


def _refused(response: Any) -> bool:
    return response.status_code == 403 and error_of(response) == (None, "auth.forbidden")


def test_a_deputy_adds_a_product(client: TestClient, client_as: ClientAs, session: Session) -> None:
    """Scenario: A deputy adds a product."""
    team = register(client)
    appoint(client, team["id"], member_id(add(client, team["id"], DEPUTY), DEPUTY))
    deputy = client_as(DEPUTY)

    product = add_product(deputy, team["id"], name="Customer portal")
    metric = deputy.post(
        f"/teams/{team['id']}/metrics",
        json={"name": "NPS", "direction": "higher_is_better", "product_id": product["id"]},
    )

    assert product["owner"]["email"] == "jan@example.com"
    assert metric.status_code == 201, metric.json()
    assert metric.json()["product"]["id"] == product["id"]


def test_an_ordinary_member_cannot_manage_projects(
    client: TestClient, client_as: ClientAs, session: Session
) -> None:
    """Scenario: An ordinary member cannot manage projects."""
    team = register(client)
    add(client, team["id"], MEMBER)
    project = add_project(client, team["id"])
    url = f"/teams/{team['id']}/projects/{project['id']}"
    member = client_as(MEMBER)

    responses = [
        post_project(member, team["id"], code="PRJ-050"),
        member.patch(url, json={"name": "Renamed"}),
        member.patch(url, json={"active": False}),
        member.delete(url),
        member.post(
            f"/teams/{team['id']}/metrics",
            json={"name": "Budget", "direction": "lower_is_better", "project_id": project["id"]},
        ),
    ]

    assert all(_refused(response) for response in responses), [r.json() for r in responses]
    assert [(p["code"], p["name"], p["active"]) for p in projects_of(client, team["id"])] == [
        (PROJECT["code"], PROJECT["name"], True)
    ]
    assert session.query(Metric).count() == 0


def test_an_administrator_manages_any_teams_projects(client: TestClient, session: Session) -> None:
    """Scenario: An administrator manages any team's projects."""
    team = register(client)

    response = post_project(client, team["id"])

    assert response.status_code == 201, response.json()
    assert session.query(Project).count() == 1


def test_a_leader_cannot_manage_another_teams_projects(
    client: TestClient, client_as: ClientAs, session: Session
) -> None:
    """Scenario: A leader cannot manage another team's projects."""
    register(client, "Platform")
    quality = register(client, "Quality", "quality-lead@example.com")
    project = add_project(client, quality["id"])
    product = add_product(client, quality["id"])
    leader = client_as(LEADER_EMAIL)

    project_change = leader.patch(
        f"/teams/{quality['id']}/projects/{project['id']}", json={"name": "Mine"}
    )
    product_change = leader.patch(
        f"/teams/{quality['id']}/products/{product['id']}", json={"name": "Mine"}
    )

    assert _refused(project_change)
    assert _refused(product_change)
    session.expire_all()
    assert [p.name for p in session.query(Project)] == [PROJECT["name"]]
    assert [p.name for p in session.query(Product)] == ["Customer portal"]


def test_anyone_signed_in_reads_projects_and_products(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: Anyone signed in reads projects and products."""
    team = register(client)
    project = add_project(client, team["id"])
    product = add_product(client, team["id"])
    stranger = client_as(STRANGER)

    listed = projects_of(stranger, team["id"])
    products = products_of(stranger, team["id"])
    one_project = stranger.get(f"/teams/{team['id']}/projects/{project['id']}")
    one_product = stranger.get(f"/teams/{team['id']}/products/{product['id']}")

    assert [p["id"] for p in listed] == [project["id"]]
    assert [p["id"] for p in products] == [product["id"]]
    assert one_project.status_code == 200
    assert one_product.json()["name"] == "Customer portal"


def test_a_member_records_a_projects_metric(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A member records a project's metric."""
    freeze_today(monkeypatch)
    team = register(client)
    add(client, team["id"], MEMBER)
    project = add_project(client, team["id"])
    budget = add_metric_of(client, team["id"], project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    value = record(client_as(MEMBER), team["id"], meeting["id"], budget["id"], value="40")

    assert (value["value"], value["recorded_by_email"]) == ("40", MEMBER)
    assert [p["value"] for p in trend_of(client, team["id"], budget["id"])["points"]] == ["40"]
