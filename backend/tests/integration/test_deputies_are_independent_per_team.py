"""One test per scenario of "Deputies are independent per team" in specs/team-membership/spec.md."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import LEADER_EMAIL, add, appoint, member_id, register

pytestmark = pytest.mark.integration


def test_a_deputy_here_leads_elsewhere(client: TestClient) -> None:
    """Scenario: A deputy here leads elsewhere."""
    led = add(client, register(client, "Quality", "jan@example.com")["id"], "anna@example.com")
    deputised = register(client, "Platform")
    add(client, deputised["id"], "zofia@example.com")
    detail = add(client, deputised["id"], "jan@example.com")

    appoint(client, deputised["id"], member_id(detail, "jan@example.com"))

    def flags(team_id: str) -> list[tuple[str, bool, bool]]:
        members = client.get(f"/teams/{team_id}").json()["members"]
        return [(m["email"], m["is_leader"], m["is_deputy"]) for m in members]

    assert flags(deputised["id"]) == [
        ("jan@example.com", False, True),
        (LEADER_EMAIL, True, False),
        ("zofia@example.com", False, False),
    ]
    assert flags(led["id"]) == [
        ("anna@example.com", False, False),
        ("jan@example.com", True, False),
    ]
