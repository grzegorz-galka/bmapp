"""One test per scenario of "The dashboard is supplied by a single authenticated summary".

In specs/dashboard/spec.md, and the cost of the summary in statements.
"""

from collections.abc import Callable
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Meeting
from app.schemas import DashboardSummary
from tests.integration.dashboard_api import (
    VIEWER,
    dashboard_of,
    freeze_today,
    problem_for,
    task_for,
    team_with,
)
from tests.integration.meetings_api import open_meeting, set_schedule
from tests.integration.metrics_api import add_metric, record
from tests.integration.pulse_api import answer

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def assigned(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> Any:
    """A viewer on one team with a schedule, responsible for a problem and a task there."""
    freeze_today(monkeypatch)
    team = team_with(client, "Platform", VIEWER)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    problem_for(client, team, VIEWER, "Builds are flaky", due_on="2026-10-14", stage="plan")
    task_for(client, team, VIEWER, "Update the agenda")
    return team


def test_the_summary_is_returned(client_as: ClientAs, assigned: Any) -> None:
    """Scenario: The summary is returned."""
    response = client_as(VIEWER).get("/dashboard")

    assert response.status_code == 200
    summary = DashboardSummary.model_validate(response.json())
    assert summary.current_user.email == VIEWER
    assert summary.declarations.goals
    assert summary.declarations.strategy.statements
    assert summary.declarations.values
    assert [team.name for team in summary.teams] == ["Platform"]
    assert [meeting.team for meeting in summary.meetings] == ["Platform"]
    assert summary.funnel.scope_teams == 1
    assert summary.funnel.stages
    assert len(summary.assigned_items) == 2


def test_the_summary_requires_authentication(anonymous_client: TestClient) -> None:
    """Scenario: The summary requires authentication."""
    response = anonymous_client.get("/dashboard")

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"


def test_the_identity_is_the_authenticated_callers(client_as: ClientAs) -> None:
    """Scenario: The identity is the authenticated caller's."""
    first = client_as("jan.kowalski@pse.pl").get("/dashboard").json()["current_user"]
    second = client_as("anna.nowak@pse.pl").get("/dashboard").json()["current_user"]

    assert first == {"email": "jan.kowalski@pse.pl", "initials": "JK"}
    assert second == {"email": "anna.nowak@pse.pl", "initials": "AN"}


def test_the_summary_changes_nothing(client_as: ClientAs, assigned: Any, session: Session) -> None:
    """Scenario: The summary changes nothing."""
    (meeting,) = dashboard_of(client_as(VIEWER))["meetings"]

    assert meeting["meeting_id"] is None
    assert (meeting["date"], meeting["start_time"]) == ("2026-10-14", "13:00")
    session.expire_all()
    assert session.scalar(sa.select(sa.func.count()).select_from(Meeting)) == 0


def _busy_team(client: TestClient, client_as: ClientAs, name: str, viewer: str) -> None:
    """A team of `viewer` with two meetings ahead, metrics, values, an answer and items."""
    team = team_with(client, name, viewer)
    set_schedule(client, team["id"])
    today = open_meeting(client, team["id"], "2026-10-12")
    open_meeting(client, team["id"], "2026-10-19")
    metric = add_metric(client, team["id"], f"{name} lead time")
    add_metric(client, team["id"], f"{name} open bugs")
    record(client, team["id"], today["id"], metric["id"], value="3")
    answer(client_as(viewer), team["id"], today["id"])
    problem = problem_for(client, team, viewer, f"{name} builds are flaky", metric_id=metric["id"])
    task_for(client, team, viewer, f"{name} retry", problem_id=problem["id"], stage="do")
    task_for(client, team, viewer, f"{name} closed", stage="act")


def _statements(session: Session, client: TestClient) -> tuple[Any, list[str]]:
    """The dashboard read through `client`, and the statements it cost."""
    session.expire_all()
    statements: list[str] = []

    def count(*args: object) -> None:
        statements.append(str(args[2]))

    connection = session.connection()
    sa.event.listen(connection, "before_cursor_execute", count)
    try:
        summary = dashboard_of(client)
    finally:
        sa.event.remove(connection, "before_cursor_execute", count)
    return summary, statements


def test_the_dashboard_costs_a_fixed_number_of_statements(
    client: TestClient,
    client_as: ClientAs,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A viewer on one team and one on three teams with two meetings each cost the same."""
    freeze_today(monkeypatch)
    lone, busy = "lone@example.com", "busy@example.com"
    _busy_team(client, client_as, "Platform", lone)
    for name in ("Payments", "Data Plane", "Identity"):
        _busy_team(client, client_as, name, busy)

    one, one_cost = _statements(session, client_as(lone))
    three, three_cost = _statements(session, client_as(busy))

    assert (len(one["teams"]), len(one["meetings"]), len(one["assigned_items"])) == (1, 2, 2)
    assert (len(three["teams"]), len(three["meetings"]), len(three["assigned_items"])) == (3, 6, 6)
    assert all(m["recorded"] is not None for m in three["meetings"])
    assert len(one_cost) == len(three_cost), (one_cost, three_cost)
    # The teams, their meetings from today on, their active metrics, the values
    # at the listed meetings, the pulse answers, who still owes data, the
    # funnel and the assigned items. The token needs no statement at all.
    assert len(three_cost) == 8, three_cost
