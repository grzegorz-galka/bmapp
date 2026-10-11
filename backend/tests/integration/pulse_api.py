"""Calls the pulse check tests share, made through the HTTP API."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import LEADER_EMAIL, add, register

#: A Monday. The week's meeting is on Wednesday the 14th, the last on the 7th.
MONDAY = datetime.date(2026, 10, 12)


def put_answer(
    client: TestClient, team_id: str, meeting_id: str, rating: Any = 4, **texts: Any
) -> Any:
    """Record the caller's answer; returns the raw response, since many tests expect a refusal."""
    body = {"rating": rating, **texts}
    return client.put(f"/teams/{team_id}/meetings/{meeting_id}/pulse/me", json=body)


def answer(client: TestClient, team_id: str, meeting_id: str, rating: int = 4, **texts: Any) -> Any:
    """Record the caller's answer and return it, failing the test if that is refused."""
    response = put_answer(client, team_id, meeting_id, rating, **texts)
    assert response.status_code == 200, response.json()
    return response.json()


def results_of(client: TestClient, team_id: str, meeting_id: str) -> Any:
    """A meeting's pulse results, failing the test if they cannot be read."""
    response = client.get(f"/teams/{team_id}/meetings/{meeting_id}/pulse")
    assert response.status_code == 200, response.json()
    return response.json()


def freeze_today(monkeypatch: pytest.MonkeyPatch, day: datetime.date = MONDAY) -> None:
    """Make the pulse and meetings endpoints believe today is `day` in the organization's zone."""
    for module in ("app.api.pulse", "app.api.meetings", "app.api.metric_values"):
        monkeypatch.setattr(f"{module}.today", lambda: day)


def team_of(client: TestClient, size: int) -> tuple[str, list[str]]:
    """Register a team of `size` members, its leader first; return its id and their emails.

    The emails sort in the order they are returned, so a test can predict the
    API's email order.
    """
    team = register(client)
    emails = [LEADER_EMAIL]
    for index in range(1, size):
        email = f"member{index:02}@example.com"
        add(client, team["id"], email)
        emails.append(email)
    return team["id"], emails


def remove(client: TestClient, team_id: str, email: str) -> None:
    """Remove a member from a team, failing the test if that is refused."""
    detail = client.get(f"/teams/{team_id}").json()
    employee_id = next(m["employee_id"] for m in detail["members"] if m["email"] == email)
    response = client.delete(f"/teams/{team_id}/members/{employee_id}")
    assert response.status_code == 200, response.json()
