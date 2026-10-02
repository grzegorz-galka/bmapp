"""One test per scenario of "Employees are identified by email" in specs/team-membership/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee, TeamMember
from tests.integration.teams_api import add, member_id, register

pytestmark = pytest.mark.integration


def test_an_email_is_normalised_before_it_is_stored(client: TestClient, session: Session) -> None:
    """Scenario: An email is normalised before it is stored."""
    team = register(client)

    detail = add(client, team["id"], "  Jan.Kowalski@Example.COM ")

    assert "jan.kowalski@example.com" in [m["email"] for m in detail["members"]]
    assert session.query(Employee).filter_by(email="jan.kowalski@example.com").count() == 1


def test_the_same_person_is_recognised_in_a_different_spelling(
    client: TestClient, session: Session
) -> None:
    """Scenario: The same person is recognised in a different spelling."""
    platform = register(client, "Platform")
    quality = register(client, "Quality")
    first = add(client, platform["id"], "jan.kowalski@example.com")

    second = add(client, quality["id"], "JAN.KOWALSKI@example.com")

    assert member_id(second, "jan.kowalski@example.com") == member_id(
        first, "jan.kowalski@example.com"
    )
    assert session.query(Employee).filter_by(email="jan.kowalski@example.com").count() == 1


@pytest.mark.parametrize("email", ["", "   "])
def test_an_email_is_blank(client: TestClient, session: Session, email: str) -> None:
    """Scenario: An email is blank."""
    team = register(client)

    response = client.post(f"/teams/{team['id']}/members", json={"email": email})

    assert response.status_code == 422
    assert response.json()["errors"][0] == {
        "field": "email",
        "code": "employee_email.blank",
        "message": "Email must not be blank.",
    }
    assert session.query(Employee).count() == 1
    assert session.query(TeamMember).count() == 1


def test_an_email_is_too_long(client: TestClient, session: Session) -> None:
    """Scenario: An email is too long."""
    team = register(client)

    response = client.post(
        f"/teams/{team['id']}/members", json={"email": "a" * 243 + "@example.com"}
    )

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("email", "employee_email.too_long")
    assert session.query(Employee).count() == 1


@pytest.mark.parametrize(
    "email", ["jan.kowalski", "a@@b.c", "@b.c", "a@bc", "jan kowalski@example.com"]
)
def test_an_email_is_malformed(client: TestClient, session: Session, email: str) -> None:
    """Scenario: An email is malformed."""
    team = register(client)

    response = client.post(f"/teams/{team['id']}/members", json={"email": email})

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("email", "employee_email.invalid")
    assert session.query(Employee).count() == 1


def test_leaving_a_team_does_not_delete_the_employee(client: TestClient, session: Session) -> None:
    """Scenario: Leaving a team does not delete the employee."""
    team = register(client)
    before = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")
    assert client.delete(f"/teams/{team['id']}/members/{before}").status_code == 200
    assert session.query(Employee).filter_by(email="jan@example.com").count() == 1

    after = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")

    assert after == before
