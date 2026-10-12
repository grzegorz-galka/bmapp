"""One test per scenario of "Change a problem or a task" in specs/problems-and-tasks/spec.md."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import (
    Kind,
    change,
    freeze_today,
    items_of,
    patch_item,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member beside its leader."""
    freeze_today(monkeypatch)
    team = register(client)
    return add(client, team["id"], MEMBER)


def test_the_due_date_is_moved(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: The due date is moved."""
    problem = raise_problem(
        client,
        team["id"],
        "Builds are flaky",
        reason="Shared test database",
        solution="One per run",
        responsible_employee_id=member_id(team, MEMBER),
        due_on="2026-10-14",
        stage="plan",
    )

    changed = change(client, team["id"], "problems", problem["id"], due_on="2026-10-21")

    assert changed["due_on"] == "2026-10-21"
    unchanged = ("due_on", "updated_at")
    assert {k: v for k, v in changed.items() if k not in unchanged} == {
        k: v for k, v in problem.items() if k not in unchanged
    }
    assert changed["updated_at"] >= problem["updated_at"]


def test_the_responsible_person_is_cleared(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: The responsible person is cleared."""
    task = raise_task(client, team["id"], responsible_employee_id=member_id(team, MEMBER))

    changed = change(client, team["id"], "tasks", task["id"], responsible_employee_id=None)

    assert changed["responsible"] is None
    assert items_of(client, team["id"], "tasks")[0]["responsible"] is None


def test_a_task_is_detached_from_its_problem(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A task is detached from its problem."""
    problem = raise_problem(client, team["id"])
    task = raise_task(client, team["id"], problem_id=problem["id"])

    changed = change(client, team["id"], "tasks", task["id"], problem_id=None)

    assert changed["problem"] is None
    assert items_of(client, team["id"], "problems") == [problem]


@pytest.mark.parametrize("kind", ["problems", "tasks"])
@pytest.mark.parametrize("whose", ["another team's", "nobody's"])
def test_the_item_does_not_belong_to_the_team(
    client: TestClient, team: dict[str, Any], kind: Kind, whose: str
) -> None:
    """Scenario: The item does not belong to the team."""
    other = register(client, "Payments", "payments.lead@example.com")
    raise_item = raise_problem if kind == "problems" else raise_task
    item_id = raise_item(client, other["id"])["id"] if whose == "another team's" else uuid.uuid4()

    response = patch_item(client, team["id"], kind, str(item_id), summary="Mine now")

    assert response.status_code == 404
    expected = "problem.not_found" if kind == "problems" else "task.not_found"
    assert error_of(response) == (None, expected)


def test_an_invalid_change_leaves_the_item_as_it_was(
    client: TestClient, team: dict[str, Any]
) -> None:
    """Scenario: An invalid change leaves the item as it was."""
    problem = raise_problem(client, team["id"], due_on="2026-10-14")

    response = patch_item(
        client, team["id"], "problems", problem["id"], due_on="2026-10-21", summary="  "
    )

    assert response.status_code == 422
    assert error_of(response) == ("summary", "item_summary.blank")
    assert items_of(client, team["id"], "problems") == [problem]
