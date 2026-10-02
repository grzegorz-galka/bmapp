"""Calls the team-membership tests share, made through the HTTP API."""

from typing import Any

from fastapi.testclient import TestClient

LEADER_EMAIL = "lead@example.com"


def register(client: TestClient, name: str = "Platform", leader: str = LEADER_EMAIL) -> Any:
    """Register a team and return its body, failing the test if that is refused."""
    response = client.post("/teams", json={"name": name, "leader_email": leader})
    assert response.status_code == 201, response.json()
    return response.json()


def add(client: TestClient, team_id: str, email: str) -> Any:
    """Add a member and return the team detail, failing the test if that is refused."""
    response = client.post(f"/teams/{team_id}/members", json={"email": email})
    assert response.status_code == 201, response.json()
    return response.json()


def member_id(detail: Any, email: str) -> str:
    """The employee identifier of the member with this email in a team detail."""
    return str(next(m["employee_id"] for m in detail["members"] if m["email"] == email))


def leaders(detail: Any) -> list[str]:
    """The emails of the members flagged as leader."""
    return [m["email"] for m in detail["members"] if m["is_leader"]]
