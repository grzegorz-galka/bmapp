"""One test per scenario of "The meetings at which an item was raised and closed"
in specs/problems-and-tasks/spec.md."""

import datetime

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import (
    MONDAY,
    change,
    freeze_today,
    items_of,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import open_meeting
from tests.integration.teams_api import register

WEDNESDAY = datetime.date(2026, 10, 14)
THURSDAY = datetime.date(2026, 10, 15)


def test_raised_before_the_coming_meeting(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Raised before the coming meeting."""
    freeze_today(monkeypatch, MONDAY)
    team = register(client)
    open_meeting(client, team["id"], "2026-10-07")
    wednesday = open_meeting(client, team["id"], "2026-10-14")

    problem = raise_problem(client, team["id"])

    assert problem["raised_meeting"] == {"id": wednesday["id"], "date": "2026-10-14"}
    assert problem["closed_meeting"] is None


def test_raised_at_the_meeting_itself(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: Raised at the meeting itself."""
    freeze_today(monkeypatch, WEDNESDAY)
    team = register(client)
    open_meeting(client, team["id"], "2026-10-07")
    today = open_meeting(client, team["id"], "2026-10-14")
    open_meeting(client, team["id"], "2026-10-21")

    task = raise_task(client, team["id"])

    assert task["raised_meeting"] == {"id": today["id"], "date": "2026-10-14"}


def test_closed_after_the_last_meeting_before_the_next_is_opened(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Closed after the last meeting, before the next is opened."""
    freeze_today(monkeypatch, MONDAY)
    team = register(client)
    open_meeting(client, team["id"], "2026-10-07")
    yesterday = open_meeting(client, team["id"], "2026-10-14")
    task = raise_task(client, team["id"], stage="do")

    freeze_today(monkeypatch, THURSDAY)
    closed = change(client, team["id"], "tasks", task["id"], stage="act")

    assert closed["closed_meeting"] == {"id": yesterday["id"], "date": "2026-10-14"}
    assert closed["raised_meeting"] == {"id": yesterday["id"], "date": "2026-10-14"}


def test_a_team_without_meetings(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A team without meetings."""
    freeze_today(monkeypatch)
    team = register(client)

    problem = raise_problem(client, team["id"], stage="act")

    assert (problem["raised_meeting"], problem["closed_meeting"]) == (None, None)
    assert problem["archived"] is True


def test_the_meeting_is_deleted(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: The meeting is deleted."""
    freeze_today(monkeypatch)
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    task = raise_task(client, team["id"])
    assert task["raised_meeting"]["id"] == meeting["id"]

    response = client.delete(f"/teams/{team['id']}/meetings/{meeting['id']}")

    assert response.status_code == 204
    [kept] = items_of(client, team["id"], "tasks")
    assert (kept["id"], kept["raised_meeting"]) == (task["id"], None)
