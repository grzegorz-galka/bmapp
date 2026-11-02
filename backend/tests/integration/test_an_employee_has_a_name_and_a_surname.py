"""One test per scenario of "An employee has a name and a surname" (team-membership spec)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.integration.teams_api import add, register

pytestmark = pytest.mark.integration


def _employee(session: Session, email: str) -> Employee:
    session.expire_all()
    return session.query(Employee).filter_by(email=email).one()


def test_a_new_employee_has_no_name(client: TestClient, session: Session) -> None:
    """Scenario: A new employee has no name."""
    team = register(client)

    add(client, team["id"], "jan.kowalski@example.com")

    employee = _employee(session, "jan.kowalski@example.com")
    assert (employee.name, employee.surname) == (None, None)


def test_reassignment_keeps_the_name(client: TestClient, session: Session) -> None:
    """Scenario: Reassignment keeps the name."""
    platform = register(client, "Platform")
    quality = register(client, "Quality")
    add(client, platform["id"], "grzegorz.galka@pse.pl")
    employee = _employee(session, "grzegorz.galka@pse.pl")
    employee.name, employee.surname = "Grzegorz", "Gałka"
    session.commit()

    add(client, quality["id"], "GRZEGORZ.GALKA@pse.pl")

    employee = _employee(session, "grzegorz.galka@pse.pl")
    assert (employee.name, employee.surname) == ("Grzegorz", "Gałka")
