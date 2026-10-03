"""The hub summary endpoint serves the landing page's data."""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.schemas import HubSummary

pytestmark = pytest.mark.integration


def test_the_summary_requires_authentication(anonymous_client: TestClient) -> None:
    """Replaces the withdrawn scenario that it needed no credentials."""
    response = anonymous_client.get("/hub")

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"


def test_the_identity_is_the_authenticated_callers(
    client_as: Callable[[str], TestClient],
) -> None:
    """Two callers, two identities, from the one request."""
    first = client_as("jan.kowalski@pse.pl").get("/hub").json()["current_user"]
    second = client_as("anna.nowak@pse.pl").get("/hub").json()["current_user"]

    assert first["email"] == "jan.kowalski@pse.pl"
    assert second["email"] == "anna.nowak@pse.pl"
    assert first["initials"] == "JK"
    assert second["initials"] == "AN"


def test_returns_a_body_matching_the_schema(client: TestClient) -> None:
    response = client.get("/hub")

    summary = HubSummary.model_validate(response.json())
    assert summary.provisional is True
    assert summary.current_user.email
    assert summary.declarations.goals
    assert summary.declarations.values
    assert summary.teams
    assert summary.funnel.stages
    assert summary.assigned_items


def test_next_meetings_are_ahead_of_the_request(client: TestClient) -> None:
    before = datetime.datetime.now(datetime.UTC)

    summary = HubSummary.model_validate(client.get("/hub").json())

    for team in summary.teams:
        assert team.next_meeting_at > before


def test_answers_without_touching_the_database(client: TestClient) -> None:
    # The hub takes no session, so it is reviewable before the database is up.
    # Requiring a token did not change that: the identity comes out of the
    # token itself, so the route depends on the authenticated person and still
    # on no session. Overriding the session dependency with one that refuses to
    # be used would not prove it; what the route declares does.
    from app.api.dependencies import AuthenticatedPersonDependency
    from app.api.hub import get_hub_summary

    annotations = get_hub_summary.__annotations__
    assert annotations.keys() - {"return"} == {"person"}
    assert annotations["person"] is AuthenticatedPersonDependency
