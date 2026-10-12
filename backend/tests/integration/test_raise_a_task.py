"""One test per scenario of "Raise a task" in specs/problems-and-tasks/spec.md."""

import datetime
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import (
    change,
    every_item,
    freeze_today,
    post_item,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member beside its leader."""
    freeze_today(monkeypatch)
    team = register(client)
    return add(client, team["id"], MEMBER)


def test_a_task_is_raised(client_as: ClientAs, team: dict[str, Any]) -> None:
    """Scenario: A task is raised."""
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)
    responsible = member_id(team, MEMBER)

    task = raise_task(
        client_as(MEMBER),
        team["id"],
        "Update the agenda",
        responsible_employee_id=responsible,
        due_on="2026-10-14",
    )

    assert (task["summary"], task["details"]) == ("Update the agenda", "")
    assert task["responsible"] == {"employee_id": responsible, "email": MEMBER}
    assert task["due_on"] == "2026-10-14"
    assert (task["metric"], task["problem"], task["stage"]) == (None, None, "not_started")
    assert datetime.datetime.fromisoformat(task["raised_at"]) >= before


def test_a_task_raised_from_a_problem(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A task raised from a problem."""
    problem = raise_problem(client, team["id"], "Builds are flaky")

    task = raise_task(client, team["id"], "Split the test database", problem_id=problem["id"])

    assert task["problem"] == {"id": problem["id"], "summary": "Builds are flaky"}


@pytest.mark.parametrize("whose", ["another team's", "nobody's"])
def test_the_problem_belongs_to_another_team(
    client: TestClient, team: dict[str, Any], whose: str
) -> None:
    """Scenario: The problem belongs to another team."""
    other = register(client, "Payments", "payments.lead@example.com")
    problem_id = (
        raise_problem(client, other["id"])["id"] if whose == "another team's" else str(uuid.uuid4())
    )

    response = post_item(client, team["id"], "tasks", "Fix it", problem_id=problem_id)

    assert response.status_code == 409
    assert error_of(response) == ("problem_id", "task_problem.not_found")
    assert every_item(client, team["id"], "tasks") == []


def test_the_problem_is_archived(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: The problem is archived."""
    problem = raise_problem(client, team["id"])
    change(client, team["id"], "problems", problem["id"], stage="act")

    response = post_item(client, team["id"], "tasks", "Fix it", problem_id=problem["id"])

    assert response.status_code == 409
    assert error_of(response) == ("problem_id", "task_problem.archived")
    assert every_item(client, team["id"], "tasks") == []


def test_details_too_long(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: Details too long."""
    response = post_item(client, team["id"], "tasks", "Fix it", details="x" * 4001)

    assert response.status_code == 422
    assert error_of(response) == ("details", "item_text.too_long")
    assert every_item(client, team["id"], "tasks") == []
