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


@pytest.mark.parametrize(
    ("payload", "expected_code"),
    [
        # A name that was submitted but says nothing is a blank name; one that
        # was never submitted, or is not text at all, never reached the rule.
        ({"name": ""}, "team_name.blank"),
        ({"name": "   "}, "team_name.blank"),
        ({}, "request.invalid_field"),
        ({"name": 123}, "request.invalid_field"),
    ],
)
def test_name_is_missing_or_blank(
    client: TestClient, session: Session, payload: dict[str, object], expected_code: str
) -> None:
    """Scenario: Name is missing or blank."""
    response = client.post("/teams", json=payload)

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert error["field"] == "name"
    assert error["code"] == expected_code
    assert session.query(Team).count() == 0


def test_name_exceeds_the_maximum_length(client: TestClient, session: Session) -> None:
    """Scenario: Name exceeds the maximum length."""
    response = client.post("/teams", json={"name": "x" * (TEAM_NAME_MAX_LENGTH + 1)})

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert error["field"] == "name"
    assert error["code"] == "team_name.too_long"
    assert session.query(Team).count() == 0


def test_name_duplicates_an_existing_team(client: TestClient, session: Session) -> None:
    """Scenario: Name duplicates an existing team.

    Differing only in case and surrounding whitespace, which the spec says
    still counts as the same name.
    """
    assert client.post("/teams", json={"name": "Platform"}).status_code == 201

    response = client.post("/teams", json={"name": "  pLaTfOrM  "})

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert error["field"] == "name"
    assert error["code"] == "team_name.duplicate"
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
