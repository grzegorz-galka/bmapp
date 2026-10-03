"""One test per scenario of "Retrieve the registered teams" in specs/team-board/spec.md."""

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.teams_api import add, register

pytestmark = pytest.mark.integration


def test_registered_teams_are_returned_in_order(client: TestClient) -> None:
    """Scenario: Registered teams are returned in order."""
    for name in ["Quality", "alpha", "Platform"]:
        register(client, name, f"lead.{name.lower()}@example.com")

    response = client.get("/teams")

    assert response.status_code == 200
    body = response.json()
    assert [team["name"] for team in body] == ["alpha", "Platform", "Quality"]
    assert all(team["board"]["name"] == team["name"] for team in body)
    assert [team["leader"]["email"] for team in body] == [
        "lead.alpha@example.com",
        "lead.platform@example.com",
        "lead.quality@example.com",
    ]
    assert all(team["member_count"] == 1 for team in body)


def test_member_count_follows_membership_changes(client: TestClient) -> None:
    """Scenario: Member count follows membership changes."""
    team = register(client)
    [before] = client.get("/teams").json()

    add(client, team["id"], "member@example.com")

    [after] = client.get("/teams").json()
    assert after["member_count"] == before["member_count"] + 1
    assert after["leader"] == before["leader"]


def test_no_teams_have_been_registered(client: TestClient) -> None:
    """Scenario: No teams have been registered - an empty list, not an error."""
    response = client.get("/teams")

    assert response.status_code == 200
    assert response.json() == []


def test_the_list_costs_a_fixed_number_of_statements(client: TestClient, session: Session) -> None:
    """Leader and member count come without a query per team."""
    for name in ["Alpha", "Beta", "Gamma"]:
        team = register(client, name, f"lead.{name.lower()}@example.com")
        add(client, team["id"], f"member.{name.lower()}@example.com")
    session.expire_all()
    statements: list[str] = []

    def count(*args: object) -> None:
        statements.append(str(args[2]))

    connection = session.connection()
    sa.event.listen(connection, "before_cursor_execute", count)
    try:
        body = client.get("/teams").json()
    finally:
        sa.event.remove(connection, "before_cursor_execute", count)

    assert [team["member_count"] for team in body] == [2, 2, 2]
    # One to resolve who is calling, one for the teams with their boards, one
    # for every team's members. The identity costs a fixed statement per
    # request; what this guards against is a statement per *team*, which is
    # why the count does not grow with the three registered above.
    assert len(statements) == 3, statements
