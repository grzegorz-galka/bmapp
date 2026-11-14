"""One test per scenario of "A project manager or product owner is named by email".

In specs/projects-and-products/spec.md.
"""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee, Project, TeamMember
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import freeze_today, put_value
from tests.integration.projects_api import add_project, post_project, seed_metric
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]


def test_a_manager_from_outside_the_team(client: TestClient, session: Session) -> None:
    """Scenario: A manager from outside the team."""
    team = register(client)

    project = add_project(client, team["id"], manager_email="ewa@example.com")

    ewa = session.query(Employee).filter_by(email="ewa@example.com").one()
    assert project["manager"]["id"] == str(ewa.id)
    assert session.query(TeamMember).filter_by(employee_id=ewa.id).count() == 0


def test_naming_someone_gives_no_permission(
    client: TestClient, client_as: ClientAs, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Naming someone gives no permission."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    project = add_project(client, team["id"], manager_email="ewa@example.com")
    metric_id = seed_metric(session, team["id"], project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    ewa = client_as("ewa@example.com")

    changed = ewa.patch(f"/teams/{team['id']}/projects/{project['id']}", json={"name": "Mine"})
    recorded = put_value(ewa, team["id"], meeting["id"], metric_id, value="40")

    assert (changed.status_code, error_of(changed)) == (403, (None, "auth.forbidden"))
    assert (recorded.status_code, error_of(recorded)) == (403, (None, "auth.forbidden"))
    read = client.get(f"/teams/{team['id']}/projects/{project['id']}").json()
    assert read["name"] == "Billing rewrite"


def test_the_email_is_malformed(client: TestClient, session: Session) -> None:
    """Scenario: The email is malformed."""
    team = register(client)
    employees = session.query(Employee).count()

    response = post_project(client, team["id"], manager_email="not-an-email")

    assert response.status_code == 422
    assert error_of(response) == ("manager_email", "employee_email.invalid")
    assert session.query(Project).count() == 0
    assert session.query(Employee).count() == employees
