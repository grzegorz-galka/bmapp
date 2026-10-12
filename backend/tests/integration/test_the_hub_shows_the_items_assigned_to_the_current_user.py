"""The recorded half of "The hub shows the items assigned to the current user" in specs/hub/spec.md.

How the list is displayed is the frontend's; these tests are about which
items the summary carries, and in what order.
"""

import datetime
from collections.abc import Callable

from fastapi.testclient import TestClient

from app.services.meetings import today as organization_today
from tests.integration.hub_api import VIEWER, hub_of, problem_for, task_for, team_with
from tests.integration.teams_api import member_id

OTHER = "other@example.com"

ClientAs = Callable[[str], TestClient]


def test_only_the_users_active_items_are_assigned(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Only the user's active items are assigned."""
    team = team_with(client, "Platform", VIEWER, OTHER)
    task = task_for(client, team, VIEWER, "Update the agenda")
    problem_for(client, team, VIEWER, "Logs are lost", stage="act")
    problem_for(client, team, OTHER, "Builds are flaky")

    items = hub_of(client_as(VIEWER))["assigned_items"]

    assert [(item["kind"], item["id"]) for item in items] == [("task", task["id"])]


def test_assigned_items_come_by_due_date_with_none_last_across_teams(
    client: TestClient, client_as: ClientAs
) -> None:
    """The order the requirement states: by due date, those without one last."""
    first = team_with(client, "Platform", VIEWER)
    second = team_with(client, "Payments", VIEWER)
    task_for(client, first, VIEWER, "No date")
    problem_for(client, second, VIEWER, "Later", due_on="2026-10-20")
    task_for(client, second, VIEWER, "Sooner", due_on="2026-10-13")

    items = hub_of(client_as(VIEWER))["assigned_items"]

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

    hub = hub_of(client_as(VIEWER))

    assert [item["id"] for item in hub["assigned_items"]] == [task["id"]]
    assert hub["funnel"]["scope_teams"] == 0


def test_an_overdue_item_is_marked_on_the_organizations_calendar(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An overdue item is distinguished - decided here, as on the board."""
    today = organization_today()
    team = team_with(client, "Platform", VIEWER)
    task_for(client, team, VIEWER, "Late", due_on=str(today - datetime.timedelta(days=1)))
    task_for(client, team, VIEWER, "Due today", due_on=str(today))
    task_for(client, team, VIEWER, "No date")

    items = hub_of(client_as(VIEWER))["assigned_items"]

    assert [(item["summary"], item["overdue"]) for item in items] == [
        ("Late", True),
        ("Due today", False),
        ("No date", False),
    ]
