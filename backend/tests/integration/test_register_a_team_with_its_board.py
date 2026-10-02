"""One test per scenario of "Register a team with its board" in specs/team-board/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import TEAM_NAME_MAX_LENGTH, BoardDefinition, Employee, Team, TeamMember
from tests.integration.teams_api import LEADER_EMAIL, register

pytestmark = pytest.mark.integration


def _nothing_created(session: Session) -> bool:
    return all(
        session.query(model).count() == 0 for model in (Team, BoardDefinition, TeamMember, Employee)
    )


def test_team_is_registered_successfully(client: TestClient, session: Session) -> None:
    """Scenario: Team is registered successfully."""
    response = client.post("/teams", json={"name": "Platform", "leader_email": LEADER_EMAIL})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Platform"
    assert body["id"]
    assert body["board"]["name"] == "Platform"
    assert body["board"]["id"]
    assert body["board"]["id"] != body["id"]
    assert body["leader"]["email"] == LEADER_EMAIL
    assert body["leader"]["id"]
    assert body["member_count"] == 1

    stored = session.query(Team).all()
    assert len(stored) == 1
    assert str(stored[0].id) == body["id"]
    assert stored[0].board is not None
    membership = session.query(TeamMember).one()
    assert membership.team_id == stored[0].id
    assert membership.is_leader
    assert str(membership.employee_id) == body["leader"]["id"]
    assert session.query(Employee).one().email == LEADER_EMAIL


def test_the_leader_is_an_employee_who_already_exists(client: TestClient, session: Session) -> None:
    """Scenario: The leader is an employee who already exists."""
    first = register(client, "Platform", "jan.kowalski@example.com")

    second = register(client, "Quality", "  JAN.Kowalski@Example.com ")

    assert second["leader"] == first["leader"]
    assert session.query(Employee).count() == 1


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
    response = client.post("/teams", json={**payload, "leader_email": LEADER_EMAIL})

    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [(e["field"], e["code"]) for e in errors] == [("name", expected_code)]
    assert _nothing_created(session)


def test_name_exceeds_the_maximum_length(client: TestClient, session: Session) -> None:
    """Scenario: Name exceeds the maximum length."""
    response = client.post(
        "/teams", json={"name": "x" * (TEAM_NAME_MAX_LENGTH + 1), "leader_email": LEADER_EMAIL}
    )

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert error["field"] == "name"
    assert error["code"] == "team_name.too_long"
    assert _nothing_created(session)


def test_name_duplicates_an_existing_team(client: TestClient, session: Session) -> None:
    """Scenario: Name duplicates an existing team.

    Differing only in case and surrounding whitespace, which the spec says
    still counts as the same name. The second leader is someone new, so that
    an employee row inserted and then rolled back would show.
    """
    register(client, "Platform")

    response = client.post(
        "/teams", json={"name": "  pLaTfOrM  ", "leader_email": "newcomer@example.com"}
    )

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert error["field"] == "name"
    assert error["code"] == "team_name.duplicate"
    assert session.query(Team).count() == 1
    assert [e.email for e in session.query(Employee)] == [LEADER_EMAIL]


def test_surrounding_whitespace_is_removed_from_the_name(
    client: TestClient, session: Session
) -> None:
    """Scenario: Surrounding whitespace is removed from the name."""
    body = register(client, "  Platform  ")

    assert body["name"] == "Platform"
    assert body["board"]["name"] == "Platform"
    assert session.query(Team).one().name == "Platform"

    # The trimmed name is what later submissions are compared against.
    response = client.post("/teams", json={"name": "Platform", "leader_email": LEADER_EMAIL})
    assert response.status_code == 409


@pytest.mark.parametrize(
    ("leader_email", "expected_code"),
    [
        (None, "request.invalid_field"),  # absent
        (123, "request.invalid_field"),  # not text
        ("   ", "employee_email.blank"),
        ("a" * 243 + "@example.com", "employee_email.too_long"),
        ("not-an-email", "employee_email.invalid"),
    ],
)
def test_leader_email_is_missing_or_invalid(
    client: TestClient, session: Session, leader_email: object, expected_code: str
) -> None:
    """Scenario: Leader email is missing or invalid."""
    payload: dict[str, object] = {"name": "Platform"}
    if leader_email is not None:
        payload["leader_email"] = leader_email

    response = client.post("/teams", json=payload)

    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [(e["field"], e["code"]) for e in errors] == [("leader_email", expected_code)]
    assert _nothing_created(session)


def test_name_and_leader_email_are_both_invalid(client: TestClient, session: Session) -> None:
    """Scenario: Name and leader email are both invalid."""
    response = client.post("/teams", json={"name": " ", "leader_email": " "})

    assert response.status_code == 422
    errors = {e["field"]: e["code"] for e in response.json()["errors"]}
    assert errors == {"name": "team_name.blank", "leader_email": "employee_email.blank"}
    assert _nothing_created(session)
