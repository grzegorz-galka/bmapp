"""Requirement: The current user can be read."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL


def test_the_current_user_is_returned(client_as: Callable[[str], TestClient]) -> None:
    response = client_as("jan.kowalski@pse.pl").get("/auth/me")
    assert response.status_code == 200
    assert response.json() == {"email": "jan.kowalski@pse.pl", "is_admin": False}


def test_an_administrator_is_reported_as_one(client_as: Callable[[str], TestClient]) -> None:
    response = client_as(ADMIN_EMAIL).get("/auth/me")
    assert response.json() == {"email": ADMIN_EMAIL, "is_admin": True}


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
