"""The hub summary endpoint serves the landing page's data.

One test per scenario of "The hub is supplied by a single authenticated
summary" in specs/hub/spec.md, and the cost of the summary in statements.
"""

import datetime
from collections.abc import Callable
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.item_enums import Stage
from app.schemas import HubSummary
from tests.integration.hub_api import VIEWER, hub_of, problem_for, task_for, team_with

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def assigned(client: TestClient) -> Any:
    """A viewer on one team, responsible for a problem and a task there."""
    team = team_with(client, "Platform", VIEWER)
    problem_for(client, team, VIEWER, "Builds are flaky", due_on="2026-10-14", stage="plan")
    task_for(client, team, VIEWER, "Update the agenda")
    return team


def test_the_summary_is_returned(client_as: ClientAs, assigned: Any) -> None:
    """Scenario: The summary is returned."""
    response = client_as(VIEWER).get("/hub")

    assert response.status_code == 200
    summary = HubSummary.model_validate(response.json())
    assert summary.current_user.email == VIEWER
    assert summary.declarations.goals
    assert summary.declarations.values
    assert summary.teams
    assert summary.preparation
    assert summary.funnel.scope_teams == 1
    assert summary.funnel.stages
    assert len(summary.assigned_items) == 2


def test_the_summary_requires_authentication(anonymous_client: TestClient) -> None:
    """Scenario: The summary requires authentication."""
    response = anonymous_client.get("/hub")

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"


def test_the_identity_is_the_authenticated_callers(client_as: ClientAs) -> None:
    """Scenario: The identity is the authenticated caller's."""
    first = client_as("jan.kowalski@pse.pl").get("/hub").json()["current_user"]
    second = client_as("anna.nowak@pse.pl").get("/hub").json()["current_user"]

    assert first["email"] == "jan.kowalski@pse.pl"
    assert second["email"] == "anna.nowak@pse.pl"
    assert first["initials"] == "JK"
    assert second["initials"] == "AN"


def test_prose_carries_both_languages(client: TestClient) -> None:
    """Scenario: Prose carries both languages."""
    declarations = hub_of(client)["declarations"]

    texts = [
        declarations["mission"],
        declarations["vision"],
        *declarations["goals"],
        *declarations["values"],
    ]
    for text in texts:
        assert set(text) == {"en", "pl"}, text
        assert text["en"].strip(), text
        assert text["pl"].strip(), text
        # A catalogue wired to itself would otherwise pass the checks above.
        assert text["en"] != text["pl"], text


def test_an_assigned_items_summary_is_returned_as_typed(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An assigned item's summary is returned as typed."""
    team = team_with(client, "Platform", VIEWER)
    task_for(client, team, VIEWER, "Zaktualizować agendę spotkania")

    (item,) = hub_of(client_as(VIEWER))["assigned_items"]

    assert item["summary"] == "Zaktualizować agendę spotkania"


def test_states_are_returned_as_codes(client_as: ClientAs, assigned: Any) -> None:
    """Scenario: States are returned as codes."""
    hub = hub_of(client_as(VIEWER))

    for team in hub["teams"]:
        assert team["role"] in {"leader", "member"}
        assert team["readiness"]["code"] in {"ready", "metrics_missing"}
    for stage in hub["funnel"]["stages"]:
        assert stage["stage"] in {"open", "in_progress", "archived"}
    assert {(item["kind"], item["stage"]) for item in hub["assigned_items"]} == {
        ("problem", "plan"),
        ("task", "not_started"),
    }
    for item in hub["assigned_items"]:
        assert item["stage"] in set(Stage)
        # No text meant for display beside the codes: the item carries its
        # identifiers, its typed summary, its team's name and its due date.
        assert set(item) == {
            "id",
            "kind",
            "summary",
            "team_id",
            "team",
            "stage",
            "due_on",
            "overdue",
        }


def test_times_are_returned_as_iso_8601_in_utc(client_as: ClientAs, assigned: Any) -> None:
    """Scenario: Times are returned as ISO 8601 in UTC."""
    hub = hub_of(client_as(VIEWER))

    for team in hub["teams"]:
        instant = datetime.datetime.fromisoformat(team["next_meeting_at"])
        assert instant.utcoffset() == datetime.timedelta(0)
    due_dates = [item["due_on"] for item in hub["assigned_items"]]
    assert due_dates == ["2026-10-14", None]
    assert datetime.date.fromisoformat(due_dates[0]) == datetime.date(2026, 10, 14)


def test_the_summary_declares_itself_provisional(client: TestClient) -> None:
    """Scenario: The summary declares itself provisional."""
    assert hub_of(client)["provisional"] is True


def test_next_meetings_are_ahead_of_the_request(client: TestClient) -> None:
    """Scenario: Next meetings are always ahead of the request, through the API.

    Of "The hub's next meetings stay ahead of the request"; the pure tests of
    that requirement are in tests/unit.
    """
    before = datetime.datetime.now(datetime.UTC)

    summary = HubSummary.model_validate(hub_of(client))

    for team in summary.teams:
        assert team.next_meeting_at > before


def test_the_hub_costs_a_fixed_number_of_statements(
    client: TestClient, client_as: ClientAs, session: Session
) -> None:
    """A person on three teams with twenty items: no statement per team or per item."""
    for index, name in enumerate(("Platform", "Payments", "Data Plane")):
        team = team_with(client, name, VIEWER)
        for number in range(7 if index < 2 else 6):
            stage = ("not_started", "do", "act")[number % 3]
            if number % 2:
                task_for(client, team, VIEWER, f"{name} task {number}", stage=stage)
            else:
                problem_for(client, team, VIEWER, f"{name} problem {number}", stage=stage)
    viewer = client_as(VIEWER)
    session.expire_all()
    statements: list[str] = []

    def count(*args: object) -> None:
        statements.append(str(args[2]))

    connection = session.connection()
    sa.event.listen(connection, "before_cursor_execute", count)
    try:
        hub = hub_of(viewer)
    finally:
        sa.event.remove(connection, "before_cursor_execute", count)

    assert sum(s["problems"] + s["tasks"] for s in hub["funnel"]["stages"]) == 20
    assert hub["funnel"]["scope_teams"] == 3
    assert len(hub["assigned_items"]) == 14
    # The scope, the funnel's grouped count over both tables, and the assigned
    # items over both tables. The token needs no statement at all.
    assert len(statements) == 3, statements
