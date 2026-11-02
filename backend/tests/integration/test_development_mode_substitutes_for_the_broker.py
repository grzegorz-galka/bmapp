"""Requirements: development mode substitutes for the broker; the development
password is derived from the email; only an employee or an administrator signs
in in development mode; a first sign-in in development mode sets a password; a
chosen development password meets minimum rules; a chosen development password
replaces the derived one."""

import logging
from collections.abc import Callable
from typing import Any

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Mode, Settings, get_settings
from app.core.exceptions import UnauthenticatedError
from app.core.security import issue_dev_token, verify_token
from app.models import DevCredential, Employee
from tests.conftest import ADMIN_EMAIL
from tests.integration.teams_api import register

CHOSEN = "zielony-las"


def _record_employee(client: TestClient, email: str) -> None:
    """Employees are recorded on first assignment, so lead a team of their own."""
    register(client, name=f"Team of {email}", leader=email)


def _sign_in(client: TestClient, email: str, password: str) -> tuple[int, Any]:
    response = client.post("/auth/dev-login", json={"email": email, "password": password})
    return response.status_code, response.json()


def _set_password(
    client: TestClient,
    email: str,
    current: str,
    new: str = CHOSEN,
    name: str | None = None,
    surname: str | None = None,
) -> tuple[int, Any]:
    response = client.post(
        "/auth/dev-password",
        json={
            "email": email,
            "current_password": current,
            "new_password": new,
            "name": name,
            "surname": surname,
        },
    )
    return response.status_code, response.json()


def _who(client: TestClient, token: str) -> dict[str, Any]:
    whoami = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert whoami.status_code == 200
    return dict(whoami.json())


def _asks_for_a_new_password(status: int, body: Any) -> None:
    assert status == 200
    assert body["password_change_required"] is True
    assert "access_token" not in body


def _employee(session: Session, email: str) -> Employee:
    session.expire_all()
    return session.scalars(select(Employee).where(Employee.email == email)).one()


def _credential(session: Session, email: str) -> DevCredential | None:
    session.expire_all()
    return session.get(DevCredential, email)


@pytest.fixture
def with_example_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    """The address the compose stack and the demo make administrator."""
    settings = get_settings()
    with_example = settings.model_copy(
        update={"admin_emails": settings.admin_emails | {"admin@example.com"}}
    )
    monkeypatch.setattr("app.api.auth.get_settings", lambda: with_example)
    monkeypatch.setattr("app.api.dependencies.get_settings", lambda: with_example)


def test_a_local_token_is_obtained_in_development_mode(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "jan.kowalski@pse.pl")
    _set_password(anonymous_client, "jan.kowalski@pse.pl", "jakopspl")

    status, body = _sign_in(anonymous_client, "jan.kowalski@pse.pl", CHOSEN)

    assert status == 200
    assert body["token_type"] == "Bearer"
    assert _who(anonymous_client, body["access_token"])["email"] == "jan.kowalski@pse.pl"


def test_the_local_login_takes_an_email_and_a_password(anonymous_client: TestClient) -> None:
    schema = anonymous_client.get("/openapi.json").json()
    body = schema["paths"]["/auth/dev-login"]["post"]["requestBody"]
    reference = body["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
    model = schema["components"]["schemas"][reference]
    assert set(model["properties"]) == {"email", "password"}
    assert set(model["required"]) == {"email", "password"}


@pytest.mark.parametrize(
    ("email", "password"),
    [("grzegorz.galka@pse.pl", "grgapspl"), ("admin@company.com", "adcoco")],
)
def test_dots_and_the_at_sign_split_the_email(
    client: TestClient, anonymous_client: TestClient, email: str, password: str
) -> None:
    _record_employee(client, email)
    _asks_for_a_new_password(*_sign_in(anonymous_client, email, password))


def test_any_character_that_is_not_a_letter_or_digit_splits_the_email(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "jan_k-x@a.pl")
    _asks_for_a_new_password(*_sign_in(anonymous_client, "jan_k-x@a.pl", "jakxapl"))


def test_a_run_of_separators_counts_once(client: TestClient, anonymous_client: TestClient) -> None:
    _record_employee(client, "a..b@c.pl")
    _asks_for_a_new_password(*_sign_in(anonymous_client, "a..b@c.pl", "abcpl"))


def test_the_password_follows_the_normalised_email(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    _asks_for_a_new_password(*_sign_in(anonymous_client, "  Grzegorz.Galka@PSE.pl ", "grgapspl"))

    # Accepted for the normalised email: setting the password through it works.
    status, body = _set_password(anonymous_client, "  Grzegorz.Galka@PSE.pl ", "grgapspl")
    assert status == 200
    assert _who(anonymous_client, body["access_token"])["email"] == "grzegorz.galka@pse.pl"


@pytest.mark.parametrize("password", ["", "grgapsp", "grgapsplx", "GRGAPSPL", "wrong"])
def test_a_wrong_password_is_refused(
    client: TestClient, anonymous_client: TestClient, password: str
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    status, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", password)

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.password_incorrect"
    assert body["errors"][0]["field"] == "password"


def test_the_one_letter_password_of_the_earlier_rule_is_refused(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    status, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "ggpp")

    assert status == 401
    assert body["errors"][0]["code"] == "auth.password_incorrect"
    assert body["errors"][0]["field"] == "password"


def test_the_administrators_password(
    anonymous_client: TestClient, with_example_admin: None
) -> None:
    _asks_for_a_new_password(*_sign_in(anonymous_client, "admin@example.com", "adexco"))


def test_an_administrator_who_is_not_an_employee_signs_in(
    anonymous_client: TestClient, session: Session
) -> None:
    assert session.scalars(select(Employee).where(Employee.email == ADMIN_EMAIL)).first() is None
    _set_password(anonymous_client, ADMIN_EMAIL, "adpspl")

    status, body = _sign_in(anonymous_client, ADMIN_EMAIL, CHOSEN)

    assert status == 200
    assert _who(anonymous_client, body["access_token"]) == {
        "email": ADMIN_EMAIL,
        "is_admin": True,
        "name": None,
        "surname": None,
        "display_name": "Admin",
        "initials": "A",
    }


def test_an_unknown_email_is_refused(anonymous_client: TestClient, session: Session) -> None:
    employees_before = session.scalar(select(func.count()).select_from(Employee))

    status, body = _sign_in(anonymous_client, "nobody@pse.pl", "nopspl")

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.employee_unknown"
    assert body["errors"][0]["field"] == "email"
    assert session.scalar(select(func.count()).select_from(Employee)) == employees_before

    # Setting a password for it is refused the same way, and stores nothing.
    status, body = _set_password(anonymous_client, "nobody@pse.pl", "nopspl")
    assert status == 401
    assert body["errors"][0]["code"] == "auth.employee_unknown"
    assert _credential(session, "nobody@pse.pl") is None
    assert session.scalar(select(func.count()).select_from(Employee)) == employees_before


def test_the_first_sign_in_asks_for_a_new_password(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _sign_in(anonymous_client, "jan.kowalski@example.com", "jakoexco")

    assert status == 200
    assert body == {"password_change_required": True, "name": "Jan", "surname": "Kowalski"}


def test_a_stored_name_is_proposed_over_the_email(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    """A missing part is proposed empty, so only "no record" hides the fields."""
    _record_employee(client, "grzegorz.galka@pse.pl")
    _employee(session, "grzegorz.galka@pse.pl").name = "Grzegorz"
    session.flush()

    _, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")

    assert body == {"password_change_required": True, "name": "Grzegorz", "surname": ""}


def test_setting_the_password_signs_the_person_in(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _set_password(
        anonymous_client,
        "jan.kowalski@example.com",
        "jakoexco",
        "zielony-las",
        name="Jan",
        surname="Kowalski-Nowak",
    )

    assert status == 200
    assert body["token_type"] == "Bearer"
    me = _who(anonymous_client, body["access_token"])
    assert me["email"] == "jan.kowalski@example.com"
    assert me["display_name"] == "Jan Kowalski-Nowak"
    employee = _employee(session, "jan.kowalski@example.com")
    assert (employee.name, employee.surname) == ("Jan", "Kowalski-Nowak")


def test_an_administrator_with_no_record_sets_only_a_password(
    anonymous_client: TestClient, session: Session, with_example_admin: None
) -> None:
    employees_before = session.scalar(select(func.count()).select_from(Employee))

    status, body = _sign_in(anonymous_client, "admin@example.com", "adexco")
    assert body == {"password_change_required": True, "name": None, "surname": None}

    status, body = _set_password(anonymous_client, "admin@example.com", "adexco")

    assert status == 200
    assert _who(anonymous_client, body["access_token"])["is_admin"] is True
    assert _credential(session, "admin@example.com") is not None
    assert session.scalar(select(func.count()).select_from(Employee)) == employees_before


@pytest.mark.parametrize(("name", "surname"), [("", ""), ("   ", " \t "), (None, None)])
def test_a_blank_name_is_stored_as_none(
    client: TestClient,
    anonymous_client: TestClient,
    session: Session,
    name: str | None,
    surname: str | None,
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _set_password(
        anonymous_client, "jan.kowalski@example.com", "jakoexco", name=name, surname=surname
    )

    assert status == 200
    employee = _employee(session, "jan.kowalski@example.com")
    assert (employee.name, employee.surname) == (None, None)
    assert _who(anonymous_client, body["access_token"])["display_name"] == "Jan Kowalski"


def test_setting_the_password_needs_the_current_one(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _set_password(
        anonymous_client, "jan.kowalski@example.com", "wrong", name="X", surname="Y"
    )

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.password_incorrect"
    assert body["errors"][0]["field"] == "password"
    assert _credential(session, "jan.kowalski@example.com") is None
    employee = _employee(session, "jan.kowalski@example.com")
    assert (employee.name, employee.surname) == (None, None)


def test_a_short_password_is_refused(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _set_password(
        anonymous_client, "jan.kowalski@example.com", "jakoexco", "kot", name="Jan"
    )

    assert status == 422
    assert body["errors"][0]["code"] == "dev_password.too_short"
    assert body["errors"][0]["field"] == "new_password"
    assert _credential(session, "jan.kowalski@example.com") is None
    assert _employee(session, "jan.kowalski@example.com").name is None


def test_keeping_the_derived_password_is_refused(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")

    status, body = _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl", "grgapspl")

    assert status == 422
    assert body["errors"][0]["code"] == "dev_password.unchanged"
    assert body["errors"][0]["field"] == "new_password"
    assert _credential(session, "grzegorz.galka@pse.pl") is None


def test_an_overlong_name_is_refused(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "jan.kowalski@example.com")

    status, body = _set_password(
        anonymous_client, "jan.kowalski@example.com", "jakoexco", name="Jan", surname="K" * 101
    )

    assert status == 422
    assert body["errors"][0]["code"] == "employee_name.too_long"
    assert body["errors"][0]["field"] == "surname"
    assert _credential(session, "jan.kowalski@example.com") is None
    assert _employee(session, "jan.kowalski@example.com").name is None


def test_the_derived_password_no_longer_signs_in(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")
    _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")

    status, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")

    assert status == 401
    assert "access_token" not in body
    assert body["errors"][0]["code"] == "auth.password_incorrect"
    assert body["errors"][0]["field"] == "password"


def test_the_chosen_password_signs_in(client: TestClient, anonymous_client: TestClient) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")
    _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")

    status, body = _sign_in(anonymous_client, "grzegorz.galka@pse.pl", CHOSEN)

    assert status == 200
    assert "password_change_required" not in body
    assert _who(anonymous_client, body["access_token"])["email"] == "grzegorz.galka@pse.pl"


def test_a_chosen_password_can_be_changed_again(
    client: TestClient, anonymous_client: TestClient
) -> None:
    """The endpoint takes the chosen password as the current one too."""
    _record_employee(client, "grzegorz.galka@pse.pl")
    _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")

    status, _ = _set_password(anonymous_client, "grzegorz.galka@pse.pl", CHOSEN, "czerwony-las")

    assert status == 200
    assert _sign_in(anonymous_client, "grzegorz.galka@pse.pl", CHOSEN)[0] == 401
    assert _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "czerwony-las")[0] == 200


def test_removing_the_stored_password_restores_the_derived_one(
    client: TestClient, anonymous_client: TestClient, session: Session
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")
    _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")
    credential = _credential(session, "grzegorz.galka@pse.pl")
    assert credential is not None
    session.delete(credential)
    session.flush()

    _asks_for_a_new_password(*_sign_in(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl"))


def test_a_sign_in_is_logged_without_the_password(
    client: TestClient, anonymous_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    _record_employee(client, "grzegorz.galka@pse.pl")
    with caplog.at_level(logging.INFO):
        _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl")
        _sign_in(anonymous_client, "grzegorz.galka@pse.pl", "secret-guess")
        _sign_in(anonymous_client, "nobody@pse.pl", "nopspl")
        _set_password(anonymous_client, "grzegorz.galka@pse.pl", "grgapspl", "kot")
        _set_password(
            anonymous_client,
            "grzegorz.galka@pse.pl",
            "grgapspl",
            CHOSEN,
            name="Grzegorz",
            surname="Gałka",
        )
        _sign_in(anonymous_client, "grzegorz.galka@pse.pl", CHOSEN)

    messages = [r.getMessage() for r in caplog.records if r.name.startswith("app.")]
    assert "Development sign-in by grzegorz.galka@pse.pl needs a new password" in messages
    assert "Development sign-in refused for grzegorz.galka@pse.pl: password incorrect" in messages
    assert "Development sign-in refused for nobody@pse.pl: employee unknown" in messages
    assert "Development password change refused for grzegorz.galka@pse.pl: too short" in messages
    assert "Development password set for grzegorz.galka@pse.pl" in messages
    assert "Development sign-in by grzegorz.galka@pse.pl" in messages
    secrets = ("grgapspl", "secret-guess", "nopspl", "kot", CHOSEN, "Grzegorz", "Gałka")
    assert not any(secret in m for m in messages for secret in secrets)


@pytest.mark.parametrize("email", ["", "   ", "not-an-email", "a@b"])
def test_the_local_login_holds_the_email_to_the_same_rule(
    anonymous_client: TestClient, email: str
) -> None:
    response = anonymous_client.post("/auth/dev-login", json={"email": email, "password": "x"})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "email"


def test_the_local_means_does_not_exist_when_the_mode_is_off() -> None:
    """In broker mode the routes are never registered, so there is nothing to reach.

    Asserted against the application's own route table rather than by starting
    a second server: the registration is what the mode decides. Both local
    routes - signing in and setting a password - come from the one function
    the mode guards, and nothing else registers either.
    """
    from app.main import app

    paths = set(app.openapi()["paths"])
    assert "/auth/me" in paths, "the identity endpoint is not conditional"
    # The suite runs in dev mode, so the routes are present here. What matters
    # is that their presence is decided by the mode and nothing else.
    import app.api.auth as auth_module

    assert {"/auth/dev-login", "/auth/dev-password"} <= paths
    assert auth_module.get_settings().mode is Mode.DEV

    unguarded = APIRouter(prefix="/auth")
    assert not unguarded.routes
    auth_module._register_dev_login(unguarded)
    registered = {getattr(route, "path", None) for route in unguarded.routes}
    assert registered == {"/auth/dev-login", "/auth/dev-password"}
    guarded = {getattr(route, "path", None) for route in auth_module.router.routes}
    assert guarded - registered == {"/auth/me"}


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


def test_a_concurrent_first_choice_is_refused_not_failed(
    client: TestClient,
    anonymous_client: TestClient,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two first choices at once: the one committing second is refused with a code.

    The race is staged by storing a password and then making the request's
    lookup miss it, as it would have when both requests read before either wrote.
    """
    _record_employee(client, "jan.kowalski@example.com")
    _set_password(anonymous_client, "jan.kowalski@example.com", "jakoexco")
    session.flush()
    real_get = Session.get

    def miss_credentials(self: Session, entity: Any, ident: Any, **kwargs: Any) -> Any:
        if entity is DevCredential:
            return None
        return real_get(self, entity, ident, **kwargs)

    monkeypatch.setattr(Session, "get", miss_credentials)
    monkeypatch.setattr(
        "app.services.dev_login._is_current_password", lambda session, email, password: True
    )

    status, body = _set_password(
        anonymous_client, "jan.kowalski@example.com", "jakoexco", "another-one"
    )

    assert status == 401
    assert body["errors"][0]["code"] == "auth.password_incorrect"
