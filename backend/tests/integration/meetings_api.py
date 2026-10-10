"""Calls the meetings tests share, made through the HTTP API."""

import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient


def set_schedule(client: TestClient, team_id: str, weekday: int = 3, time: str = "13:00") -> Any:
    """Set a board's schedule and return the team, failing the test if that is refused."""
    response = client.put(f"/teams/{team_id}/schedule", json={"weekday": weekday, "time": time})
    assert response.status_code == 200, response.json()
    return response.json()


def open_meeting(client: TestClient, team_id: str, date: str, time: str = "13:00") -> Any:
    """Open a meeting and return it, failing the test if that is refused."""
    response = client.post(f"/teams/{team_id}/meetings", json={"date": date, "time": time})
    assert response.status_code == 201, response.json()
    return response.json()


def meetings_of(client: TestClient, team_id: str) -> Any:
    """The team's meeting list, failing the test if it cannot be read."""
    response = client.get(f"/teams/{team_id}/meetings")
    assert response.status_code == 200, response.json()
    return response.json()


def dates_of(listing: Any) -> list[str]:
    return [meeting["date"] for meeting in listing["meetings"]]


def error_of(response: Any) -> tuple[str | None, str]:
    """The field and code of the one error a rejection carries."""
    [error] = response.json()["errors"]
    return error["field"], error["code"]


def freeze_today(monkeypatch: pytest.MonkeyPatch, day: datetime.date) -> None:
    """Make the meetings API believe today is `day` in the organization's zone."""
    monkeypatch.setattr("app.api.meetings.today", lambda: day)
