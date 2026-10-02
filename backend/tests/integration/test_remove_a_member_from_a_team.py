"""One test per scenario of "Remove a member from a team" in specs/team-membership/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.integration.teams_api import LEADER_EMAIL, add, leaders, member_id, register

pytestmark = pytest.mark.integration


def test_a_member_is_removed(client: TestClient, session: Session) -> None:
    """Scenario: A member is removed."""
    team = register(client, "Platform")
    other = register(client, "Quality")
    add(client, other["id"], "jan@example.com")
    jan = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")

    response = client.delete(f"/teams/{team['id']}/members/{jan}")

    assert response.status_code == 200
    body = response.json()
    assert [m["email"] for m in body["members"]] == [LEADER_EMAIL]
    assert leaders(body) == [LEADER_EMAIL]
    assert session.query(Employee).filter_by(email="jan@example.com").count() == 1
    assert "jan@example.com" in [
        m["email"] for m in client.get(f"/teams/{other['id']}").json()["members"]
    ]


def test_the_leader_cannot_be_removed(client: TestClient) -> None:
    """Scenario: The leader cannot be removed."""
    team = register(client)
    before = add(client, team["id"], "jan@example.com")

    response = client.delete(f"/teams/{team['id']}/members/{team['leader']['id']}")

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team_member.is_leader")
    assert client.get(f"/teams/{team['id']}").json() == before


def test_the_employee_is_not_a_member(client: TestClient) -> None:
    """Scenario: The employee is not a member."""
    team = register(client, "Platform")
    other = register(client, "Quality")
    outsider = member_id(add(client, other["id"], "jan@example.com"), "jan@example.com")

    response = client.delete(f"/teams/{team['id']}/members/{outsider}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team_member.not_found")


def test_a_member_is_removed_from_a_team_that_does_not_exist(client: TestClient) -> None:
    """Scenario: A member is removed from a team that does not exist."""
    response = client.delete(f"/teams/{uuid.uuid4()}/members/{uuid.uuid4()}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")
