"""The API half of "The items assigned to the viewer" in specs/dashboard/spec.md.

How the list is displayed is the frontend's; these tests are about which
items the summary carries, with what, and in what order. *An assigned item's
summary is returned as typed*, of "The summary is language-neutral", is here
too, beside the other assigned items.
"""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.services.meetings import today as organization_today
from tests.integration.dashboard_api import (
    VIEWER,
    dashboard_of,
    freeze_today,
    problem_for,
    task_for,
    team_with,
)
from tests.integration.metrics_api import add_metric
from tests.integration.teams_api import member_id

OTHER = "other@example.com"

ClientAs = Callable[[str], TestClient]


def test_assigned_items_are_shown_in_detail(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Assigned items are shown in detail."""
    freeze_today(monkeypatch)
    team = team_with(client, "Platform", VIEWER, OTHER)
    metric = add_metric(client, team["id"], "Lead time")
    source = problem_for(client, team, OTHER, "Builds are flaky")
    task = task_for(
        client,
        team,
        VIEWER,
        "Split the test database",
        due_on="2026-10-20",
        stage="do",
        metric_id=metric["id"],
        problem_id=source["id"],
    )
    problem = problem_for(client, team, VIEWER, "Logs are lost", metric_id=metric["id"])

    dashboard = dashboard_of(client_as(VIEWER))

    assert dashboard["current_user"]["email"] == VIEWER
    assert dashboard["assigned_items"] == [
        {
            "id": task["id"],
            "kind": "task",
            "summary": "Split the test database",
            "team_id": team["id"],
            "team": "Platform",
            "stage": "do",
            "due_on": "2026-10-20",
            "overdue": False,
            "metric": {"id": metric["id"], "name": "Lead time"},
            "problem": {"id": source["id"], "summary": "Builds are flaky"},
        },
        {
            "id": problem["id"],
            "kind": "problem",
            "summary": "Logs are lost",
            "team_id": team["id"],
            "team": "Platform",
            "stage": "not_started",
            "due_on": None,
            "overdue": False,
            "metric": {"id": metric["id"], "name": "Lead time"},
            "problem": None,
        },
    ]


def test_only_the_viewers_active_items_are_listed(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Only the viewer's active items are listed."""
    team = team_with(client, "Platform", VIEWER, OTHER)
    task = task_for(client, team, VIEWER, "Update the agenda")
    problem_for(client, team, VIEWER, "Logs are lost", stage="act")
    problem_for(client, team, OTHER, "Builds are flaky")

    items = dashboard_of(client_as(VIEWER))["assigned_items"]

    assert [(item["kind"], item["id"]) for item in items] == [("task", task["id"])]
    assert (items[0]["metric"], items[0]["problem"]) == (None, None)


def test_an_assigned_items_summary_is_returned_as_typed(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An assigned item's summary is returned as typed."""
    team = team_with(client, "Platform", VIEWER)
    task_for(client, team, VIEWER, "Zaktualizować agendę spotkania")

    (item,) = dashboard_of(client_as(VIEWER))["assigned_items"]

    assert item["summary"] == "Zaktualizować agendę spotkania"


def test_an_overdue_item_is_distinguished(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: An overdue item is distinguished - decided here, on the organization's calendar."""
    today = organization_today()
    team = team_with(client, "Platform", VIEWER)
    task_for(client, team, VIEWER, "Late", due_on=str(today - datetime.timedelta(days=1)))
    task_for(client, team, VIEWER, "Due today", due_on=str(today))
    task_for(client, team, VIEWER, "No date")

    items = dashboard_of(client_as(VIEWER))["assigned_items"]

    assert [(item["summary"], item["overdue"]) for item in items] == [
        ("Late", True),
        ("Due today", False),
        ("No date", False),
    ]


def test_assigned_items_come_by_due_date_with_none_last_across_teams(
    client: TestClient, client_as: ClientAs
) -> None:
    """The order the requirement states: by due date, those without one last."""
    first = team_with(client, "Platform", VIEWER)
    second = team_with(client, "Payments", VIEWER)
    task_for(client, first, VIEWER, "No date")
    problem_for(client, second, VIEWER, "Later", due_on="2026-10-20")
    task_for(client, second, VIEWER, "Sooner", due_on="2026-10-13")

    items = dashboard_of(client_as(VIEWER))["assigned_items"]

    assert [(item["summary"], item["team"], item["due_on"]) for item in items] == [
        ("Sooner", "Payments", "2026-10-13"),
        ("Later", "Payments", "2026-10-20"),
        ("No date", "Platform", None),
    ]
    assert items[2]["team_id"] == first["id"]


def test_an_item_stays_assigned_after_its_responsible_person_leaves_the_team(
    client: TestClient, client_as: ClientAs
) -> None:
    """A person who leaves stays responsible until someone changes it, so still sees it."""
    team = team_with(client, "Platform", VIEWER)
    task = task_for(client, team, VIEWER, "Update the agenda")
    response = client.delete(f"/teams/{team['id']}/members/{member_id(team, VIEWER)}")
    assert response.status_code == 200, response.text

    dashboard = dashboard_of(client_as(VIEWER))

    assert [item["id"] for item in dashboard["assigned_items"]] == [task["id"]]
    assert dashboard["funnel"]["scope_teams"] == 0
