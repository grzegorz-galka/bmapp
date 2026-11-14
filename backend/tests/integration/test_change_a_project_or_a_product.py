"""One test per scenario of "Change a project or a product".

In specs/projects-and-products/spec.md.
"""

import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Metric, MetricValue
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import freeze_today
from tests.integration.projects_api import add_product, add_project, seed_metric, seed_value
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_a_project_is_extended_and_handed_over(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A project is extended and handed over."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")
    metric_id = seed_metric(session, team["id"], project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    seed_value(session, metric_id, meeting["id"], "40")

    response = client.patch(
        f"/teams/{team['id']}/projects/{project['id']}",
        json={"end_date": "2027-06-30", "manager_email": "piotr@example.com"},
    )

    assert response.status_code == 200, response.json()
    changed = response.json()
    assert changed["end_date"] == "2027-06-30"
    assert changed["manager"]["email"] == "piotr@example.com"
    assert (changed["code"], changed["start_date"]) == ("PRJ-042", "2026-09-01")
    session.expire_all()
    assert [m.name for m in session.query(Metric).filter_by(name="Budget consumed")] == [
        "Budget consumed"
    ]
    assert [str(v.value) for v in session.query(MetricValue).all()] == ["40.000000"]


def test_a_products_link_is_removed(client: TestClient) -> None:
    """Scenario: A product's link is removed."""
    team = register(client)
    product = add_product(client, team["id"])

    response = client.patch(
        f"/teams/{team['id']}/products/{product['id']}", json={"jira_url": None}
    )

    assert response.status_code == 200, response.json()
    assert response.json()["jira_url"] is None
    assert response.json()["name"] == product["name"]


def test_a_change_breaking_a_rule_is_refused(client: TestClient) -> None:
    """Scenario: A change breaking a rule is refused."""
    team = register(client)
    add_project(client, team["id"], code="PRJ-042")
    other = add_project(client, team["id"], code="PRJ-050")
    url = f"/teams/{team['id']}/projects/{other['id']}"

    response = client.patch(url, json={"code": "prj-042"})
    # The dialog always sends the manager with the other fields.
    with_manager = client.patch(url, json={"code": "prj-042", "manager_email": "anna@example.com"})

    assert response.status_code == 409
    assert error_of(response) == ("code", "project_code.duplicate")
    assert (with_manager.status_code, error_of(with_manager)) == (
        409,
        ("code", "project_code.duplicate"),
    )
    assert client.get(url).json()["code"] == "PRJ-050"


def test_a_change_moving_the_end_before_the_start_is_refused(client: TestClient) -> None:
    """The dates rule holds for a change naming one date only."""
    team = register(client)
    project = add_project(client, team["id"], start_date="2026-09-01", end_date="2027-03-31")
    url = f"/teams/{team['id']}/projects/{project['id']}"

    response = client.patch(url, json={"end_date": "2026-08-31"})

    assert response.status_code == 422
    assert error_of(response) == ("end_date", "project_dates.order")
    assert client.get(url).json()["end_date"] == "2027-03-31"


def test_a_products_name_and_owner_change(client: TestClient) -> None:
    """Every property of a product changes, and a clash in the team is refused."""
    team = register(client)
    add_product(client, team["id"], name="Billing")
    product = add_product(client, team["id"], name="Customer portal")
    url = f"/teams/{team['id']}/products/{product['id']}"

    changed = client.patch(
        url,
        json={
            "name": "Portal",
            "owner_email": "ola@example.com",
            "jira_url": "http://j.example.com",
        },
    )
    clash = client.patch(url, json={"name": "billing"})
    clash_with_owner = client.patch(url, json={"name": "billing", "owner_email": "ola@example.com"})

    assert changed.status_code == 200, changed.json()
    assert (changed.json()["name"], changed.json()["owner"]["email"]) == (
        "Portal",
        "ola@example.com",
    )
    assert changed.json()["jira_url"] == "http://j.example.com"
    assert (clash.status_code, error_of(clash)) == (409, ("name", "product_name.duplicate"))
    assert (clash_with_owner.status_code, error_of(clash_with_owner)) == (
        409,
        ("name", "product_name.duplicate"),
    )
    assert client.get(url).json()["name"] == "Portal"
