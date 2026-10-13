"""One test per scenario of "Appoint a leader deputy" in specs/team-membership/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import (
    LEADER_EMAIL,
    add,
    appoint,
    deputies,
    leaders,
    member_id,
    register,
)

pytestmark = pytest.mark.integration


def test_a_member_is_appointed_deputy(client: TestClient) -> None:
    """Scenario: A member is appointed deputy."""
    team = register(client)
    detail = add(client, team["id"], "jan@example.com")

    response = client.put(f"/teams/{team['id']}/deputies/{member_id(detail, 'jan@example.com')}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == team["id"]
    assert [m["email"] for m in body["members"]] == ["jan@example.com", LEADER_EMAIL]
    assert deputies(body) == ["jan@example.com"]
    assert leaders(body) == [LEADER_EMAIL]


def test_a_team_has_several_deputies(client: TestClient) -> None:
    """Scenario: A team has several deputies."""
    team = register(client)
    add(client, team["id"], "anna@example.com")
    detail = add(client, team["id"], "jan@example.com")

    appoint(client, team["id"], member_id(detail, "anna@example.com"))
    body = appoint(client, team["id"], member_id(detail, "jan@example.com"))

    assert deputies(body) == ["anna@example.com", "jan@example.com"]
    assert leaders(body) == [LEADER_EMAIL]


def test_a_deputy_is_appointed_again(client: TestClient) -> None:
    """Scenario: A deputy is appointed again."""
    team = register(client)
    jan = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")
    before = appoint(client, team["id"], jan)

    response = client.put(f"/teams/{team['id']}/deputies/{jan}")

    assert response.status_code == 200
    assert response.json() == before


def test_the_leader_cannot_be_a_deputy(client: TestClient) -> None:
    """Scenario: The leader cannot be a deputy."""
    team = register(client)

    response = client.put(f"/teams/{team['id']}/deputies/{team['leader']['id']}")

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("employee_id", "team_deputy.is_leader")
    assert deputies(client.get(f"/teams/{team['id']}").json()) == []


def test_the_deputy_is_not_a_member(client: TestClient) -> None:
    """Scenario: The deputy is not a member."""
    team = register(client, "Platform")
    before = client.get(f"/teams/{team['id']}").json()
    other = register(client, "Quality")
    outsider = member_id(add(client, other["id"], "jan@example.com"), "jan@example.com")

    response = client.put(f"/teams/{team['id']}/deputies/{outsider}")

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("employee_id", "team_deputy.not_member")
    assert client.get(f"/teams/{team['id']}").json() == before


def test_a_deputy_of_a_team_that_does_not_exist(client: TestClient) -> None:
    """Scenario: A deputy of a team that does not exist."""
    response = client.put(f"/teams/{uuid.uuid4()}/deputies/{uuid.uuid4()}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")
