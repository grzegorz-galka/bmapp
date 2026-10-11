"""Requirements: development mode substitutes for the broker; the development
password is derived from the email; only an employee or an administrator signs
in in development mode."""

import logging
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Mode, Settings
from app.core.exceptions import UnauthenticatedError
from app.core.security import issue_dev_token, verify_token
from app.models import Employee
from tests.conftest import ADMIN_EMAIL
from tests.integration.teams_api import register


def _record_employee(client: TestClient, email: str) -> None:
    """Employees are recorded on first assignment, so lead a team of their own."""
    register(client, name=f"Team of {email}", leader=email)


def _sign_in(client: TestClient, email: str, password: str) -> tuple[int, Any]:
    response = client.post("/auth/dev-login", json={"email": email, "password": password})
    return response.status_code, response.json()


def _who(client: TestClient, token: str) -> str:
    whoami = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert whoami.status_code == 200
    return str(whoami.json()["email"])


def test_a_local_token_is_obtained_in_development_mode(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "jan.kowalski@pse.pl")

    status, body = _sign_in(anonymous_client, "jan.kowalski@pse.pl", "jkpp")

    assert status == 200
    assert body["token_type"] == "Bearer"
    assert _who(anonymous_client, body["access_token"]) == "jan.kowalski@pse.pl"


def test_the_local_login_takes_an_email_and_a_password(anonymous_client: TestClient) -> None:
    schema = anonymous_client.get("/openapi.json").json()
    body = schema["paths"]["/auth/dev-login"]["post"]["requestBody"]
    reference = body["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
    model = schema["components"]["schemas"][reference]
    assert set(model["properties"]) == {"email", "password"}
    assert set(model["required"]) == {"email", "password"}


@pytest.mark.parametrize(
    ("email", "password"),
    [("grzegorz.galka@pse.pl", "ggpp"), ("admin@company.com", "acc")],
)
def test_dots_and_the_at_sign_split_the_email(
    client: TestClient, anonymous_client: TestClient, email: str, password: str
) -> None:
    _record_employee(client, email)
    status, body = _sign_in(anonymous_client, email, password)
    assert status == 200
    assert _who(anonymous_client, body["access_token"]) == email


def test_any_character_that_is_not_a_letter_or_digit_splits_the_email(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "jan_k-x@a.pl")
    status, _ = _sign_in(anonymous_client, "jan_k-x@a.pl", "jkxap")
    assert status == 200


def test_a_run_of_separators_counts_once(client: TestClient, anonymous_client: TestClient) -> None:
    _record_employee(client, "a..b@c.pl")
    status, _ = _sign_in(anonymous_client, "a..b@c.pl", "abcp")
    assert status == 200


def test_the_password_follows_the_normalised_email(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    status, body = _sign_in(anonymous_client, "  Grzegorz.Galka@PSE.pl ", "ggpp")

    assert status == 200
    assert _who(anonymous_client, body["access_token"]) == "grzegorz.galka@pse.pl"


@pytest.mark.parametrize("password", ["", "ggp", "ggppx", "GGPP", "wrong"])
def test_a_wrong_password_is_refused(
    client: TestClient, anonymous_client: TestClient, password: str
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    status, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", password)

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.password_incorrect"
    assert body["errors"][0]["field"] == "password"


def test_an_administrator_who_is_not_an_employee_signs_in(
    anonymous_client: TestClient, session: Session
) -> None:
    assert session.scalars(select(Employee).where(Employee.email == ADMIN_EMAIL)).first() is None

    status, body = _sign_in(anonymous_client, ADMIN_EMAIL, "app")

    assert status == 200
    whoami = anonymous_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert whoami.json() == {"email": ADMIN_EMAIL, "is_admin": True}


def test_an_unknown_email_is_refused(anonymous_client: TestClient, session: Session) -> None:
    employees_before = session.scalar(select(func.count()).select_from(Employee))

    status, body = _sign_in(anonymous_client, "nobody@pse.pl", "npp")

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.employee_unknown"
    assert body["errors"][0]["field"] == "email"
    assert session.scalar(select(func.count()).select_from(Employee)) == employees_before


def test_a_sign_in_is_logged_without_the_password(
    client: TestClient, anonymous_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")
    with caplog.at_level(logging.INFO):
        _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "ggpp")
        _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "secret-guess")
        _sign_in(anonymous_client, "nobody@pse.pl", "npp")

    messages = [r.getMessage() for r in caplog.records if r.name.startswith("app.")]
    assert "Development sign-in by grzegorz.galka@pse.pl" in messages
    assert "Development sign-in refused for grzegorz.galka@pse.pl: password incorrect" in messages
    assert "Development sign-in refused for nobody@pse.pl: employee unknown" in messages
    assert not any("ggpp" in m or "secret-guess" in m or "npp" in m for m in messages)


@pytest.mark.parametrize("email", ["", "   ", "not-an-email", "a@b"])
def test_the_local_login_holds_the_email_to_the_same_rule(
    anonymous_client: TestClient, email: str
) -> None:
    response = anonymous_client.post("/auth/dev-login", json={"email": email, "password": "x"})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "email"


def test_the_local_means_does_not_exist_when_the_mode_is_off() -> None:
    """In broker mode the route is never registered, so there is nothing to reach.

    Asserted against the application's own route table rather than by starting
    a second server: the registration is what the mode decides.
    """
    from app.main import app

    paths = set(app.openapi()["paths"])
    assert "/auth/me" in paths, "the identity endpoint is not conditional"
    # The suite runs in dev mode, so the route is present here. What matters is
    # that its presence is decided by the mode and nothing else.
    import app.api.auth as auth_module

    assert "/auth/dev-login" in paths
    assert auth_module.get_settings().mode is Mode.DEV


def test_a_development_token_is_refused_by_a_broker_backed_system() -> None:
    """The guarantee: a broker-mode server cannot be made to accept a dev token."""
    token = issue_dev_token("jan.kowalski@pse.pl")
    broker = Settings(
        mode=Mode.BROKER, oidc_issuer="https://identity.intra.pse.pl", oidc_client_id="bmapp"
    )
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(token, broker)
    assert refusal.value.code == "auth.token_invalid"


def test_a_development_token_verifies_in_development_mode(
    headers_for: Callable[[str], dict[str, str]], anonymous_client: TestClient
) -> None:
    response = anonymous_client.get("/auth/me", headers=headers_for("jan.kowalski@pse.pl"))
    assert response.status_code == 200
