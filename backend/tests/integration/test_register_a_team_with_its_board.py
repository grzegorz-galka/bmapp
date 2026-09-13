"""One test per scenario of "Register a team with its board" in specs/team-board/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import TEAM_NAME_MAX_LENGTH, Team

pytestmark = pytest.mark.integration


def test_team_is_registered_successfully(client: TestClient, session: Session) -> None:
    """Scenario: Team is registered successfully."""
    response = client.post("/teams", json={"name": "Platform"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Platform"
    assert body["id"]
    assert body["board"]["name"] == "Platform"
    assert body["board"]["id"]
    assert body["board"]["id"] != body["id"]

    stored = session.query(Team).all()
    assert len(stored) == 1
    assert str(stored[0].id) == body["id"]
    assert stored[0].board is not None


@pytest.mark.parametrize("payload", [{}, {"name": ""}, {"name": "   "}])
def test_name_is_missing_or_blank(
    client: TestClient, session: Session, payload: dict[str, str]
) -> None:
    """Scenario: Name is missing or blank."""
    response = client.post("/teams", json=payload)

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "name"
    assert session.query(Team).count() == 0


def test_name_exceeds_the_maximum_length(client: TestClient, session: Session) -> None:
    """Scenario: Name exceeds the maximum length."""
    response = client.post("/teams", json={"name": "x" * (TEAM_NAME_MAX_LENGTH + 1)})

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "name"
    assert session.query(Team).count() == 0


def test_name_duplicates_an_existing_team(client: TestClient, session: Session) -> None:
    """Scenario: Name duplicates an existing team.

    Differing only in case and surrounding whitespace, which the spec says
    still counts as the same name.
    """
    assert client.post("/teams", json={"name": "Platform"}).status_code == 201

    response = client.post("/teams", json={"name": "  pLaTfOrM  "})

    assert response.status_code == 409
    assert response.json()["errors"][0]["field"] == "name"
    assert session.query(Team).count() == 1


def test_surrounding_whitespace_is_removed_from_the_name(
    client: TestClient, session: Session
) -> None:
    """Scenario: Surrounding whitespace is removed from the name."""
    response = client.post("/teams", json={"name": "  Platform  "})

    assert response.status_code == 201
    assert response.json()["name"] == "Platform"
    assert response.json()["board"]["name"] == "Platform"
    assert session.query(Team).one().name == "Platform"

    # The trimmed name is what later submissions are compared against.
    assert client.post("/teams", json={"name": "Platform"}).status_code == 409
