"""One test per scenario of "Retrieve the registered teams" in specs/team-board/spec.md."""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


def test_registered_teams_are_returned_in_order(client: TestClient) -> None:
    """Scenario: Registered teams are returned in order."""
    for name in ["Quality", "alpha", "Platform"]:
        assert client.post("/teams", json={"name": name}).status_code == 201

    response = client.get("/teams")

    assert response.status_code == 200
    body = response.json()
    assert [team["name"] for team in body] == ["alpha", "Platform", "Quality"]
    assert all(team["board"]["name"] == team["name"] for team in body)


def test_no_teams_have_been_registered(client: TestClient) -> None:
    """Scenario: No teams have been registered - an empty list, not an error."""
    response = client.get("/teams")

    assert response.status_code == 200
    assert response.json() == []
