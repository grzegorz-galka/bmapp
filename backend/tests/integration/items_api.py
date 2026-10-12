"""Calls the problems and tasks tests share, made through the HTTP API."""

import datetime
from typing import Any, Literal

import pytest
from fastapi.testclient import TestClient

#: A Monday. The week's meeting is on Wednesday the 14th, the last on the 7th.
MONDAY = datetime.date(2026, 10, 12)

Kind = Literal["problems", "tasks"]


def post_item(client: TestClient, team_id: str, kind: Kind, summary: Any, **fields: Any) -> Any:
    """Raise an item; returns the raw response, since many tests expect a refusal."""
    body = {"summary": summary, **fields} if summary is not None else fields
    return client.post(f"/teams/{team_id}/{kind}", json=body)


def raise_problem(
    client: TestClient, team_id: str, summary: str = "Builds are flaky", **fields: Any
) -> Any:
    """Raise a problem and return it, failing the test if that is refused."""
    response = post_item(client, team_id, "problems", summary, **fields)
    assert response.status_code == 201, response.json()
    return response.json()


def raise_task(
    client: TestClient, team_id: str, summary: str = "Update the agenda", **fields: Any
) -> Any:
    """Raise a task and return it, failing the test if that is refused."""
    response = post_item(client, team_id, "tasks", summary, **fields)
    assert response.status_code == 201, response.json()
    return response.json()


def patch_item(client: TestClient, team_id: str, kind: Kind, item_id: str, **fields: Any) -> Any:
    """Change an item; returns the raw response, since many tests expect a refusal."""
    return client.patch(f"/teams/{team_id}/{kind}/{item_id}", json=fields)


def change(client: TestClient, team_id: str, kind: Kind, item_id: str, **fields: Any) -> Any:
    """Change an item and return it, failing the test if that is refused."""
    response = patch_item(client, team_id, kind, item_id, **fields)
    assert response.status_code == 200, response.json()
    return response.json()


def items_of(
    client: TestClient,
    team_id: str,
    kind: Kind,
    state: Literal["active", "archived"] = "active",
) -> Any:
    """A team's active or archived items of one kind, failing the test if they cannot be read."""
    response = client.get(f"/teams/{team_id}/{kind}", params={"state": state})
    assert response.status_code == 200, response.json()
    return response.json()


def every_item(client: TestClient, team_id: str, kind: Kind) -> Any:
    """Active and archived alike: what "nothing is recorded" is checked against."""
    return items_of(client, team_id, kind) + items_of(client, team_id, kind, "archived")


def summaries(items: Any) -> list[str]:
    return [item["summary"] for item in items]


def freeze_today(monkeypatch: pytest.MonkeyPatch, day: datetime.date = MONDAY) -> None:
    """Make the items, meetings and metrics endpoints believe today is `day`."""
    for module in ("problems", "tasks", "meetings", "metrics", "metric_values"):
        monkeypatch.setattr(f"app.api.{module}.today", lambda: day)
