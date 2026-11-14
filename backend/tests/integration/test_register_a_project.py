"""One test per scenario of "Register a project" in specs/projects-and-products/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee, Project
from tests.integration.meetings_api import error_of
from tests.integration.projects_api import add_project, post_project
from tests.integration.teams_api import LEADER_EMAIL, register

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]


def test_a_project_is_added(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A project is added."""
    team = register(client)

    project = add_project(
        client_as(LEADER_EMAIL),
        team["id"],
        code="PRJ-042",
        name="Billing rewrite",
        manager_email="anna@example.com",
        start_date="2026-09-01",
        end_date="2027-03-31",
    )

    assert project["id"]
    assert project["team_id"] == team["id"]
    assert (project["code"], project["name"]) == ("PRJ-042", "Billing rewrite")
    assert project["manager"]["email"] == "anna@example.com"
    assert project["manager"]["display_name"] == "Anna"
    assert (project["start_date"], project["end_date"]) == ("2026-09-01", "2027-03-31")
    assert project["active"] is True


def test_the_code_is_taken_in_another_team(client: TestClient, session: Session) -> None:
    """Scenario: The code is taken in another team."""
    platform = register(client, "Platform")
    quality = register(client, "Quality", "quality-lead@example.com")
    add_project(client, platform["id"], code="PRJ-042")

    response = post_project(client, quality["id"], code="prj-042", manager_email="new@example.com")

    assert response.status_code == 409
    assert error_of(response) == ("code", "project_code.duplicate")
    assert session.query(Project).count() == 1
    assert session.query(Employee).filter_by(email="new@example.com").count() == 0


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("code", "  ", "project_code.blank"),
        ("code", "x" * 51, "project_code.too_long"),
        ("name", "", "project_name.blank"),
        ("name", "x" * 201, "project_name.too_long"),
    ],
)
def test_code_or_name_is_blank_or_too_long(
    client: TestClient, session: Session, field: str, value: str, code: str
) -> None:
    """Scenario: Code or name is blank or too long."""
    team = register(client)

    response = post_project(client, team["id"], **{field: value})

    assert response.status_code == 422
    assert error_of(response) == (field, code)
    assert session.query(Project).count() == 0


def test_the_end_is_before_the_start(client: TestClient, session: Session) -> None:
    """Scenario: The end is before the start."""
    team = register(client)

    response = post_project(client, team["id"], start_date="2026-09-01", end_date="2026-08-31")

    assert response.status_code == 422
    assert error_of(response) == ("end_date", "project_dates.order")
    assert session.query(Project).count() == 0


def test_a_project_lasting_one_day(client: TestClient) -> None:
    """Scenario: A project lasting one day."""
    team = register(client)

    project = add_project(client, team["id"], start_date="2026-09-01", end_date="2026-09-01")

    assert (project["start_date"], project["end_date"]) == ("2026-09-01", "2026-09-01")
