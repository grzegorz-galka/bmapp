"""Setting up what the dashboard's tests read, through the HTTP API."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import raise_problem, raise_task
from tests.integration.teams_api import add, member_id, register

#: The person the dashboard is requested by.
VIEWER = "viewer@example.com"

#: A Monday, pinned as today in the organization's zone.
MONDAY = datetime.date(2026, 10, 12)


def freeze_today(monkeypatch: pytest.MonkeyPatch, day: datetime.date = MONDAY) -> None:
    """Make the dashboard and the endpoints a test sets data up through believe today is `day`."""
    for module in (
        "dashboard",
        "meetings",
        "metric_values",
        "pulse",
        "problems",
        "tasks",
        "metrics",
    ):
        monkeypatch.setattr(f"app.api.{module}.today", lambda: day)


def team_with(client: TestClient, name: str, *emails: str) -> Any:
    """A team whose members include `emails`; returns its detail."""
    team = register(client, name)
    for email in emails:
        team = add(client, team["id"], email)
    return team


def problem_for(client: TestClient, team: Any, email: str, summary: str, **fields: Any) -> Any:
    """A problem of `team` that the member with `email` is responsible for."""
    return raise_problem(
        client, team["id"], summary, responsible_employee_id=member_id(team, email), **fields
    )


def task_for(client: TestClient, team: Any, email: str, summary: str, **fields: Any) -> Any:
    """A task of `team` that the member with `email` is responsible for."""
    return raise_task(
        client, team["id"], summary, responsible_employee_id=member_id(team, email), **fields
    )


def dashboard_of(client: TestClient) -> Any:
    """The dashboard summary, failing the test if it cannot be read."""
    response = client.get("/dashboard")
    assert response.status_code == 200, response.json()
    return response.json()
