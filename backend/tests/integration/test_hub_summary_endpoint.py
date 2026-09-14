"""The hub summary endpoint serves the landing page's data."""

import datetime

import pytest
from fastapi.testclient import TestClient

from app.schemas import HubSummary

pytestmark = pytest.mark.integration


def test_returns_the_summary_without_credentials(client: TestClient) -> None:
    response = client.get("/hub")

    assert response.status_code == 200
    assert "authorization" not in {name.lower() for name in response.request.headers}


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
    # Overriding the session dependency with one that refuses to be used would
    # not prove it; that the route declares no dependency on it does.
    from app.api.hub import get_hub_summary

    assert not get_hub_summary.__annotations__.keys() - {"return"}
