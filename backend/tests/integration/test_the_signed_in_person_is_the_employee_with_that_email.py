"""Requirement: The signed-in person is the employee with that email."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import UnauthenticatedError
from app.core.security import issue_dev_token
from app.models import Employee


def employee_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Employee)) or 0


def resolve(session: Session, email: str):
    """Run the dependency directly, which is where the lookup lives."""
    return get_current_user(session, f"Bearer {issue_dev_token(email)}")


def test_the_email_identifies_a_recorded_employee(client: TestClient, session: Session) -> None:
    client.post("/teams", json={"name": "Platform", "leader_email": "lead@pse.pl"})

    current = resolve(session, "lead@pse.pl")

    assert current.employee is not None
    assert current.employee.email == "lead@pse.pl"
    assert current.require_employee().email == "lead@pse.pl"


def test_an_employee_is_matched_in_a_different_letter_case(
    client: TestClient, session: Session
) -> None:
    """The broker's claim and the recorded email need not agree on case."""
    client.post("/teams", json={"name": "Platform", "leader_email": "lead@pse.pl"})

    current = resolve(session, "LEAD@PSE.pl")

    assert current.employee is not None
    assert current.employee.email == "lead@pse.pl"


def test_the_email_matches_no_employee(session: Session) -> None:
    before = employee_count(session)

    current = resolve(session, "nobody@pse.pl")

    assert current.email == "nobody@pse.pl"
    assert current.employee is None
    assert employee_count(session) == before, "signing in must not record an employee"


def test_a_write_by_someone_who_is_not_an_employee_is_refused(session: Session) -> None:
    current = resolve(session, "nobody@pse.pl")

    try:
        current.require_employee()
    except Exception as refusal:
        assert refusal.__class__.__name__ == "NotAnEmployeeError"
        assert refusal.code == "auth.not_an_employee"  # type: ignore[attr-defined]
        assert refusal.status_code == 403  # type: ignore[attr-defined]
    else:
        raise AssertionError("a write by a non-employee must be refused")


def test_authenticating_repeatedly_records_nobody(session: Session) -> None:
    """Not once, and not on the hundredth sign-in either."""
    before = employee_count(session)
    for _ in range(5):
        resolve(session, "nobody@pse.pl")
    assert employee_count(session) == before


def test_a_token_that_identifies_nobody_is_refused(session: Session) -> None:
    from datetime import UTC, datetime, timedelta

    import jwt

    from app.core.config import get_settings
    from app.core.security import DEV_ISSUER, _dev_secret

    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "iss": DEV_ISSUER,
            "aud": get_settings().audience,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        _dev_secret(),
        algorithm="HS256",
    )
    try:
        get_current_user(session, f"Bearer {token}")
    except UnauthenticatedError as refusal:
        assert refusal.code == "auth.token_invalid"
    else:
        raise AssertionError("a token with no email claim must be refused")
