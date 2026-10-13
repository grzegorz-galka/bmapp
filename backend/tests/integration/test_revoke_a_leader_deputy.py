"""One test per scenario of "Revoke a leader deputy" in specs/team-membership/spec.md."""

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


def test_a_deputy_is_revoked(client: TestClient) -> None:
    """Scenario: A deputy is revoked."""
    team = register(client)
    add(client, team["id"], "anna@example.com")
    detail = add(client, team["id"], "jan@example.com")
    anna, jan = member_id(detail, "anna@example.com"), member_id(detail, "jan@example.com")
    appoint(client, team["id"], anna)
    appoint(client, team["id"], jan)

    response = client.delete(f"/teams/{team['id']}/deputies/{jan}")

    assert response.status_code == 200
    body = response.json()
    assert [m["email"] for m in body["members"]] == [
        "anna@example.com",
        "jan@example.com",
        LEADER_EMAIL,
    ]
    assert deputies(body) == ["anna@example.com"]
    assert leaders(body) == [LEADER_EMAIL]


def test_revoking_a_member_who_is_not_a_deputy(client: TestClient) -> None:
    """Scenario: Revoking a member who is not a deputy."""
    team = register(client)
    before = add(client, team["id"], "jan@example.com")

    response = client.delete(f"/teams/{team['id']}/deputies/{member_id(before, 'jan@example.com')}")

    assert response.status_code == 200
    assert response.json() == before


def test_revoking_someone_who_is_not_a_member(client: TestClient) -> None:
    """Scenario: Revoking someone who is not a member."""
    team = register(client, "Platform")
    other = register(client, "Quality")
    outsider = member_id(add(client, other["id"], "jan@example.com"), "jan@example.com")

    response = client.delete(f"/teams/{team['id']}/deputies/{outsider}")

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team_member.not_found")
