"""Setting up the recorded items the hub's tests read, through the HTTP API."""

from typing import Any

from fastapi.testclient import TestClient

from tests.integration.items_api import raise_problem, raise_task
from tests.integration.teams_api import add, member_id, register

#: The person the hub is requested by.
VIEWER = "viewer@example.com"


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


def hub_of(client: TestClient) -> Any:
    """The hub summary, failing the test if it cannot be read."""
    response = client.get("/hub")
    assert response.status_code == 200, response.json()
    return response.json()
