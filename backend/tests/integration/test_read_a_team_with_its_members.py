"""One test per scenario of "Read a team with its members" in specs/team-membership/spec.md."""

import uuid

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.integration.teams_api import add, appoint, member_id, register

pytestmark = pytest.mark.integration


def test_a_team_is_returned_with_its_members(client: TestClient, session: Session) -> None:
    """Scenario: A team is returned with its members."""
    team = register(client, "Platform", "maria.wisniewska@example.com")
    add(client, team["id"], "zofia@example.com")
    add(client, team["id"], "adam.nowak@example.com")
    # A stored name wins over the one the email gives.
    session.execute(
        sa.update(Employee)
        .where(Employee.email == "zofia@example.com")
        .values(name="Zofia", surname="Wójcik")
    )
    session.commit()

    response = client.get(f"/teams/{team['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == team["id"]
    assert body["name"] == "Platform"
    assert body["board"] == team["board"]
    assert [
        (m["email"], m["display_name"], m["is_leader"], m["is_deputy"]) for m in body["members"]
    ] == [
        ("adam.nowak@example.com", "Adam Nowak", False, False),
        ("maria.wisniewska@example.com", "Maria Wisniewska", True, False),
        ("zofia@example.com", "Zofia Wójcik", False, False),
    ]
    leader = next(m for m in body["members"] if m["is_leader"])
    assert leader["employee_id"] == team["leader"]["id"]
    listed = next(t for t in client.get("/teams").json() if t["id"] == team["id"])
    assert listed["leader"]["display_name"] == "Maria Wisniewska"


def test_a_team_is_returned_with_its_deputies(client: TestClient) -> None:
    """Scenario: A team is returned with its deputies."""
    team = register(client, "Platform", "maria@example.com")
    add(client, team["id"], "adam@example.com")
    detail = add(client, team["id"], "zofia@example.com")
    appoint(client, team["id"], member_id(detail, "zofia@example.com"))

    response = client.get(f"/teams/{team['id']}")

    assert response.status_code == 200
    assert [(m["email"], m["is_leader"], m["is_deputy"]) for m in response.json()["members"]] == [
        ("adam@example.com", False, False),
        ("maria@example.com", True, False),
        ("zofia@example.com", False, True),
    ]


def test_the_team_does_not_exist(client: TestClient) -> None:
    """Scenario: The team does not exist."""
    response = client.get(f"/teams/{uuid.uuid4()}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")
