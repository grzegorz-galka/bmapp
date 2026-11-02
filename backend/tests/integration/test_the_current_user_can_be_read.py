"""Requirement: The current user can be read."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee
from tests.conftest import ADMIN_EMAIL
from tests.integration.teams_api import register


def test_the_current_user_is_returned(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    register(client, name="Platform", leader="grzegorz.galka@pse.pl")
    employee = session.scalars(
        select(Employee).where(Employee.email == "grzegorz.galka@pse.pl")
    ).one()
    employee.name, employee.surname = "Grzegorz", "Gałka"
    session.flush()

    response = client_as("grzegorz.galka@pse.pl").get("/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "email": "grzegorz.galka@pse.pl",
        "is_admin": False,
        "name": "Grzegorz",
        "surname": "Gałka",
        "display_name": "Grzegorz Gałka",
        "initials": "GG",
    }


def test_a_person_with_no_stored_name_is_returned_with_a_derived_display_name(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    register(client, name="Platform", leader="jan.kowalski@example.com")

    response = client_as("jan.kowalski@example.com").get("/auth/me")

    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["surname"]) == (None, None)
    assert body["display_name"] == "Jan Kowalski"
    assert body["initials"] == "JK"


def test_a_person_with_no_employee_record_is_named_from_the_email(
    client_as: Callable[[str], TestClient],
) -> None:
    response = client_as("jan.kowalski@pse.pl").get("/auth/me")
    assert response.json() == {
        "email": "jan.kowalski@pse.pl",
        "is_admin": False,
        "name": None,
        "surname": None,
        "display_name": "Jan Kowalski",
        "initials": "JK",
    }


def test_an_administrator_is_reported_as_one(client_as: Callable[[str], TestClient]) -> None:
    response = client_as(ADMIN_EMAIL).get("/auth/me")
    assert response.json() == {
        "email": ADMIN_EMAIL,
        "is_admin": True,
        "name": None,
        "surname": None,
        "display_name": "Admin",
        "initials": "A",
    }


def test_an_administrator_is_recognised_in_a_different_spelling(
    client_as: Callable[[str], TestClient],
) -> None:
    """Configuration and the broker's claim need not agree on letter case."""
    response = client_as(ADMIN_EMAIL.upper()).get("/auth/me")
    assert response.json()["is_admin"] is True


def test_an_unauthenticated_caller_is_refused(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/auth/me")
    assert response.status_code == 401
    assert response.json() == {
        "errors": [
            {
                "field": None,
                "code": "auth.token_missing",
                "message": "No access token was presented.",
            }
        ]
    }


@pytest.mark.parametrize("header", ["", "Bearer", "Basic abc", "Bearer not.a.token", "Bearer "])
def test_an_unusable_authorization_header_is_refused(
    anonymous_client: TestClient, header: str
) -> None:
    response = anonymous_client.get("/auth/me", headers={"Authorization": header})
    assert response.status_code == 401
    assert response.json()["errors"][0]["code"].startswith("auth.token_")
