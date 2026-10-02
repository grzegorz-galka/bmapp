"""One test per scenario of "Add a member to a team" in specs/team-membership/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.integration.teams_api import LEADER_EMAIL, add, member_id, register

pytestmark = pytest.mark.integration


def test_a_new_employee_is_added(client: TestClient, session: Session) -> None:
    """Scenario: A new employee is added."""
    team = register(client)

    response = client.post(f"/teams/{team['id']}/members", json={"email": "jan@example.com"})

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == team["id"]
    assert [(m["email"], m["is_leader"]) for m in body["members"]] == [
        ("jan@example.com", False),
        (LEADER_EMAIL, True),
    ]
    assert session.query(Employee).filter_by(email="jan@example.com").count() == 1


def test_an_existing_employee_is_added(client: TestClient, session: Session) -> None:
    """Scenario: An existing employee is added."""
    other = register(client, "Quality")
    jan = member_id(add(client, other["id"], "jan@example.com"), "jan@example.com")
    team = register(client, "Platform")

    body = add(client, team["id"], "jan@example.com")

    assert member_id(body, "jan@example.com") == jan
    assert "jan@example.com" in [
        m["email"] for m in client.get(f"/teams/{other['id']}").json()["members"]
    ]
    assert session.query(Employee).count() == 2


def test_the_employee_is_already_a_member(client: TestClient) -> None:
    """Scenario: The employee is already a member."""
    team = register(client)
    before = add(client, team["id"], "jan@example.com")

    response = client.post(f"/teams/{team['id']}/members", json={"email": "JAN@example.com"})

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("email", "team_member.duplicate")
    assert client.get(f"/teams/{team['id']}").json() == before


def test_a_member_is_added_to_a_team_that_does_not_exist(
    client: TestClient, session: Session
) -> None:
    """Scenario: A member is added to a team that does not exist."""
    response = client.post(f"/teams/{uuid.uuid4()}/members", json={"email": "jan@example.com"})

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")
    assert session.query(Employee).count() == 0
