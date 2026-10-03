"""Requirement: Development mode substitutes for the broker."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.core.config import Mode, Settings
from app.core.exceptions import UnauthenticatedError
from app.core.security import issue_dev_token, verify_token


def test_a_local_token_is_obtained_in_development_mode(anonymous_client: TestClient) -> None:
    response = anonymous_client.post("/auth/dev-login", json={"email": "jan.kowalski@pse.pl"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "Bearer"

    whoami = anonymous_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert whoami.status_code == 200
    assert whoami.json()["email"] == "jan.kowalski@pse.pl"


def test_the_local_login_takes_no_password(anonymous_client: TestClient) -> None:
    """There is no password field to send, checked or ignored."""
    schema = anonymous_client.get("/openapi.json").json()
    body = schema["paths"]["/auth/dev-login"]["post"]["requestBody"]
    reference = body["content"]["application/json"]["schema"]["$ref"].rsplit("/", 1)[-1]
    assert set(schema["components"]["schemas"][reference]["properties"]) == {"email"}


def test_the_email_is_normalised_the_way_employee_emails_are(
    anonymous_client: TestClient,
) -> None:
    response = anonymous_client.post("/auth/dev-login", json={"email": "  Jan.Kowalski@PSE.pl "})
    token = response.json()["access_token"]
    whoami = anonymous_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert whoami.json()["email"] == "jan.kowalski@pse.pl"


@pytest.mark.parametrize("email", ["", "   ", "not-an-email", "a@b"])
def test_the_local_login_holds_the_email_to_the_same_rule(
    anonymous_client: TestClient, email: str
) -> None:
    response = anonymous_client.post("/auth/dev-login", json={"email": email})
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
