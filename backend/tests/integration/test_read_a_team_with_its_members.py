"""One test per scenario of "Read a team with its members" in specs/team-membership/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import add, register

pytestmark = pytest.mark.integration


def test_a_team_is_returned_with_its_members(client: TestClient) -> None:
    """Scenario: A team is returned with its members."""
    team = register(client, "Platform", "maria@example.com")
    add(client, team["id"], "zofia@example.com")
    add(client, team["id"], "adam@example.com")

    response = client.get(f"/teams/{team['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == team["id"]
    assert body["name"] == "Platform"
    assert body["board"] == team["board"]
    assert [(m["email"], m["is_leader"]) for m in body["members"]] == [
        ("adam@example.com", False),
        ("maria@example.com", True),
        ("zofia@example.com", False),
    ]
    leader = next(m for m in body["members"] if m["is_leader"])
    assert leader["employee_id"] == team["leader"]["id"]


def test_the_team_does_not_exist(client: TestClient) -> None:
    """Scenario: The team does not exist."""
    response = client.get(f"/teams/{uuid.uuid4()}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")
