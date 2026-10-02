"""Finding or recording an employee, exercised directly against a session."""

import pytest
from sqlalchemy.orm import Session

from app.models import Employee
from app.services import get_or_create_employee

pytestmark = pytest.mark.integration


def test_the_same_email_twice_returns_one_row(session: Session) -> None:
    first = get_or_create_employee(session, "jan@example.com")
    second = get_or_create_employee(session, "jan@example.com")

    assert first.id == second.id
    assert session.query(Employee).count() == 1


def test_a_rolled_back_caller_leaves_no_row_behind(session: Session) -> None:
    get_or_create_employee(session, "jan@example.com")

    session.rollback()

    assert session.query(Employee).count() == 0
