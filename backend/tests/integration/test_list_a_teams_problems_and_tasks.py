"""One test per scenario of "List a team's problems and tasks"
in specs/problems-and-tasks/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import (
    change,
    freeze_today,
    items_of,
    raise_problem,
    raise_task,
    summaries,
)
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.teams_api import register

TUESDAY = datetime.date(2026, 10, 13)
WEDNESDAY = datetime.date(2026, 10, 14)


def test_active_items_in_order_of_due_date(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Active items in order of due date."""
    freeze_today(monkeypatch)
    team = register(client)
    raise_task(client, team["id"], "Due 20 October", due_on="2026-10-20")
    raise_task(client, team["id"], "No due date")
    raise_task(client, team["id"], "Closed", due_on="2026-10-13", stage="act")
    raise_task(client, team["id"], "Due 15 October", due_on="2026-10-15")
    raise_task(client, team["id"], "Also no due date, raised later")

    listed = items_of(client, team["id"], "tasks")

    assert summaries(listed) == [
        "Due 15 October",
        "Due 20 October",
        "No due date",
        "Also no due date, raised later",
    ]


def test_archived_items_latest_closed_first(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Archived items, latest closed first."""
    freeze_today(monkeypatch)
    team = register(client)
    earlier = open_meeting(client, team["id"], "2026-10-07")
    coming = open_meeting(client, team["id"], "2026-10-14")
    raise_problem(client, team["id"], "Still open")
    first = raise_problem(client, team["id"], "Closed first")
    second = raise_problem(client, team["id"], "Closed second")
    change(client, team["id"], "problems", first["id"], stage="act")
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    change(client, team["id"], "problems", second["id"], stage="act")

    listed = items_of(client, team["id"], "problems", "archived")

    assert summaries(listed) == ["Closed second", "Closed first"]
    meetings = [(p["raised_meeting"]["id"], p["closed_meeting"]["id"]) for p in listed]
    assert meetings == [(coming["id"], coming["id"]), (coming["id"], coming["id"])]
    assert earlier["id"] not in {m for pair in meetings for m in pair}


def test_an_overdue_item(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: An overdue item."""
    freeze_today(monkeypatch, TUESDAY)
    team = register(client)
    raise_task(client, team["id"], "Due 13 October", due_on="2026-10-13")
    raise_task(client, team["id"], "Due 14 October", due_on="2026-10-14")

    freeze_today(monkeypatch, WEDNESDAY)
    listed = items_of(client, team["id"], "tasks")

    assert [(t["summary"], t["overdue"]) for t in listed] == [
        ("Due 13 October", True),
        ("Due 14 October", False),
    ]


def test_an_archived_item_is_never_overdue(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An archived item is never overdue."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 5))
    team = register(client)
    problem = raise_problem(client, team["id"], due_on="2026-10-01")
    assert problem["overdue"] is True
    change(client, team["id"], "problems", problem["id"], stage="act")

    freeze_today(monkeypatch)
    [listed] = items_of(client, team["id"], "problems", "archived")

    assert (listed["id"], listed["overdue"]) == (problem["id"], False)


def test_a_team_with_no_items(client: TestClient) -> None:
    """Scenario: A team with no items."""
    team = register(client)

    assert items_of(client, team["id"], "problems") == []
    assert items_of(client, team["id"], "tasks", "archived") == []


def test_an_unknown_state_or_team_is_refused(client: TestClient) -> None:
    """Not a scenario: what the two rejections of the list look like."""
    team = register(client)

    unknown_state = client.get(f"/teams/{team['id']}/tasks", params={"state": "closed"})
    unknown_team = client.get("/teams/00000000-0000-0000-0000-000000000000/problems")

    assert (unknown_state.status_code, error_of(unknown_state)) == (
        422,
        ("state", "request.invalid_field"),
    )
    assert (unknown_team.status_code, error_of(unknown_team)) == (404, (None, "team.not_found"))
