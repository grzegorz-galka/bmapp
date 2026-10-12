"""One test per scenario of "Progress is a PDCA stage" in specs/problems-and-tasks/spec.md."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import change, freeze_today, items_of, raise_problem, raise_task
from tests.integration.teams_api import LEADER_EMAIL, add, register

MEMBER = "member@example.com"

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member beside its leader."""
    freeze_today(monkeypatch)
    team = register(client)
    return add(client, team["id"], MEMBER)


def test_a_stage_is_moved_on(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A stage is moved on."""
    task = raise_task(client, team["id"], stage="plan")

    moved = change(client, team["id"], "tasks", task["id"], stage="do")

    assert (moved["stage"], moved["archived"], moved["closed_at"]) == ("do", False, None)
    assert [t["stage"] for t in items_of(client, team["id"], "tasks")] == ["do"]


def test_a_stage_is_moved_back(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A stage is moved back."""
    problem = raise_problem(client, team["id"], stage="check")

    moved = change(client, team["id"], "problems", problem["id"], stage="plan")

    assert (moved["stage"], moved["archived"], moved["closed_at"]) == ("plan", False, None)
    assert [p["stage"] for p in items_of(client, team["id"], "problems")] == ["plan"]


def test_setting_the_same_stage_twice_changes_nothing_more(
    client_as: ClientAs, team: dict[str, Any]
) -> None:
    """Scenario: Setting the same stage twice changes nothing more."""
    task = raise_task(client_as(LEADER_EMAIL), team["id"], stage="plan")

    change(client_as(LEADER_EMAIL), team["id"], "tasks", task["id"], stage="do")
    second = change(client_as(MEMBER), team["id"], "tasks", task["id"], stage="do")

    assert (second["stage"], second["archived"]) == ("do", False)
