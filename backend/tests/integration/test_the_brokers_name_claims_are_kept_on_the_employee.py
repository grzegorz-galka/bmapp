"""Requirement: The broker's name claims are kept on the employee.

The suite runs in development mode, so broker mode is put in force for these
requests by substituting the settings the dependencies read and the key set a
token is verified against: the tokens are RS256, signed by a key generated in
the test, exactly as the broker-mode unit tests build them.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Mode, Settings, get_settings
from app.core.security import DEV_ISSUER, _dev_secret, verify_token
from app.models import Employee
from tests.integration.teams_api import register

ISSUER = "https://identity.intra.pse.pl"
AUDIENCE = "bmapp"

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)

BrokerClient = Callable[..., TestClient]


def _broker_token(email: str, **name_claims: str) -> str:
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=30),
        "email": email,
        **name_claims,
    }
    return jwt.encode(claims, _PRIVATE_KEY, algorithm="RS256")


@pytest.fixture
def broker_client(
    make_client: Callable[[dict[str, str]], TestClient], monkeypatch: pytest.MonkeyPatch
) -> BrokerClient:
    """A factory for a client carrying a broker token, with broker mode in force.

    Broker mode is switched on only when the first such client is built, so a
    test can record employees with the development-mode `client` beforehand.
    """

    def build(email: str, **name_claims: str) -> TestClient:
        broker = Settings(
            mode=Mode.BROKER,
            oidc_issuer=ISSUER,
            oidc_client_id=AUDIENCE,
            admin_emails=get_settings().admin_emails,
        )
        monkeypatch.setattr("app.api.dependencies.get_settings", lambda: broker)
        monkeypatch.setattr(
            "app.core.security._signing_key", lambda token, settings: _PRIVATE_KEY.public_key()
        )
        return make_client({"Authorization": f"Bearer {_broker_token(email, **name_claims)}"})

    return build


def _employee(session: Session, email: str) -> Employee:
    session.expire_all()
    return session.scalars(select(Employee).where(Employee.email == email)).one()


def test_name_claims_are_stored(
    client: TestClient, broker_client: BrokerClient, session: Session
) -> None:
    register(client, leader="grzegorz.galka@pse.pl")

    response = broker_client(
        "grzegorz.galka@pse.pl", given_name="Grzegorz", family_name="Gałka"
    ).get("/auth/me")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Grzegorz Gałka"
    assert response.json()["initials"] == "GG"
    employee = _employee(session, "grzegorz.galka@pse.pl")
    assert (employee.name, employee.surname) == ("Grzegorz", "Gałka")


@pytest.mark.parametrize("claims", [{}, {"given_name": "", "family_name": "   "}])
def test_a_token_without_name_claims_changes_nothing(
    client: TestClient, broker_client: BrokerClient, session: Session, claims: dict[str, str]
) -> None:
    register(client, leader="grzegorz.galka@pse.pl")
    employee = _employee(session, "grzegorz.galka@pse.pl")
    employee.name, employee.surname = "Grzegorz", "Gałka"
    session.flush()

    response = broker_client("grzegorz.galka@pse.pl", **claims).get("/auth/me")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Grzegorz Gałka"
    employee = _employee(session, "grzegorz.galka@pse.pl")
    assert (employee.name, employee.surname) == ("Grzegorz", "Gałka")


def test_only_the_claim_that_is_present_is_stored(
    client: TestClient, broker_client: BrokerClient, session: Session
) -> None:
    register(client, leader="grzegorz.galka@pse.pl")
    employee = _employee(session, "grzegorz.galka@pse.pl")
    employee.name, employee.surname = "Grzegorz", "Galka"
    session.flush()

    broker_client("grzegorz.galka@pse.pl", family_name="Gałka").get("/auth/me")

    employee = _employee(session, "grzegorz.galka@pse.pl")
    assert (employee.name, employee.surname) == ("Grzegorz", "Gałka")


def test_a_person_who_is_not_an_employee_is_not_recorded(
    broker_client: BrokerClient, session: Session
) -> None:
    employees_before = session.scalar(select(func.count()).select_from(Employee))

    response = broker_client("anna.nowak@pse.pl", given_name="Anna", family_name="Nowak").get(
        "/auth/me"
    )

    assert response.status_code == 200
    assert response.json() == {
        "email": "anna.nowak@pse.pl",
        "is_admin": False,
        "name": None,
        "surname": None,
        "display_name": "Anna Nowak",
        "initials": "AN",
    }
    assert session.scalar(select(func.count()).select_from(Employee)) == employees_before


def test_name_claims_are_read_only_in_broker_mode() -> None:
    """A dev-mode token that somehow carried name claims could still rename nobody."""
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "iss": DEV_ISSUER,
            "aud": get_settings().audience,
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "email": "grzegorz.galka@pse.pl",
            "given_name": "Grzegorz",
            "family_name": "Gałka",
        },
        _dev_secret(),
        algorithm="HS256",
    )

    person = verify_token(token, get_settings())

    assert (person.given_name, person.family_name) == (None, None)


def test_the_dashboard_names_a_viewer_with_no_record_from_the_claims(
    broker_client: BrokerClient,
) -> None:
    """The summary and `/auth/me` name the same caller the same way."""
    caller = broker_client("g.galka@pse.pl", given_name="Grzegorz", family_name="Gałka")

    summary = caller.get("/dashboard").json()["current_user"]
    me = caller.get("/auth/me").json()

    assert summary["display_name"] == me["display_name"] == "Grzegorz Gałka"
    assert summary["initials"] == me["initials"] == "GG"
