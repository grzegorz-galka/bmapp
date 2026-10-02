"""One test per scenario of "An employee may belong to and lead many teams".

From specs/team-membership/spec.md.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.integration.teams_api import add, leaders, member_id, register

pytestmark = pytest.mark.integration


def test_one_employee_leads_two_teams(client: TestClient, session: Session) -> None:
    """Scenario: One employee leads two teams."""
    platform = register(client, "Platform", "maria@example.com")
    quality = register(client, "Quality", "maria@example.com")

    assert platform["leader"] == quality["leader"]
    assert [t["leader"]["email"] for t in client.get("/teams").json()] == [
        "maria@example.com",
        "maria@example.com",
    ]
    assert session.query(Employee).count() == 1


def test_leaving_one_team_leaves_the_others_untouched(client: TestClient) -> None:
    """Scenario: Leaving one team leaves the others untouched."""
    platform = register(client, "Platform")
    quality = register(client, "Quality")
    jan = member_id(add(client, platform["id"], "jan@example.com"), "jan@example.com")
    add(client, quality["id"], "jan@example.com")
    client.put(f"/teams/{quality['id']}/leader", json={"employee_id": jan})
    before = client.get(f"/teams/{quality['id']}").json()
    assert leaders(before) == ["jan@example.com"]

    response = client.delete(f"/teams/{platform['id']}/members/{jan}")

    assert response.status_code == 200
    assert client.get(f"/teams/{quality['id']}").json() == before
