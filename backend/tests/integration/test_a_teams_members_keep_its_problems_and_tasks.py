"""One test per scenario of "A team's members keep its problems and tasks"
in specs/authorization/spec.md."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.items_api import (
    change,
    every_item,
    freeze_today,
    items_of,
    patch_item,
    post_item,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import add, register

MEMBER = "member@example.com"
#: A recorded employee - a member of another team - but a stranger to this one.
STRANGER = "stranger@example.com"

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member beside its leader, and a stranger on another team."""
    freeze_today(monkeypatch)
    other = register(client, "Payments", "payments.lead@example.com")
    add(client, other["id"], STRANGER)
    team = register(client)
    return add(client, team["id"], MEMBER)


def test_a_member_raises_a_task(client_as: ClientAs, team: dict[str, Any]) -> None:
    """Scenario: A member raises a task."""
    task = raise_task(client_as(MEMBER), team["id"], "Update the agenda")

    assert (task["summary"], task["stage"]) == ("Update the agenda", "not_started")
    assert items_of(client_as(MEMBER), team["id"], "tasks") == [task]


def test_an_administrator_closes_a_problem(
    client: TestClient, client_as: ClientAs, team: dict[str, Any]
) -> None:
    """Scenario: An administrator closes a problem."""
    problem = raise_problem(client_as(MEMBER), team["id"])

    closed = change(client_as(ADMIN_EMAIL), team["id"], "problems", problem["id"], stage="act")

    assert (closed["stage"], closed["archived"]) == ("act", True)
    assert items_of(client, team["id"], "problems", "archived") == [closed]


def test_a_stranger_cannot_raise_or_change_an_item(
    client_as: ClientAs, team: dict[str, Any]
) -> None:
    """Scenario: A stranger cannot raise or change an item."""
    member = client_as(MEMBER)
    task = raise_task(member, team["id"])
    stranger = client_as(STRANGER)

    raised = post_item(stranger, team["id"], "problems", "Not mine to raise")
    changed = patch_item(stranger, team["id"], "tasks", task["id"], stage="do")

    for response in (raised, changed):
        assert response.status_code == 403
        assert error_of(response) == (None, "auth.forbidden")
    assert every_item(member, team["id"], "problems") == []
    assert items_of(member, team["id"], "tasks") == [task]


def test_a_stranger_reads_the_items(client_as: ClientAs, team: dict[str, Any]) -> None:
    """Scenario: A stranger reads the items."""
    member = client_as(MEMBER)
    problem = raise_problem(member, team["id"])
    task = raise_task(member, team["id"], stage="act")
    stranger = client_as(STRANGER)

    assert items_of(stranger, team["id"], "problems") == [problem]
    assert items_of(stranger, team["id"], "tasks", "archived") == [task]


def test_the_refusal_comes_before_the_archive(client_as: ClientAs, team: dict[str, Any]) -> None:
    """Scenario: The refusal comes before the archive."""
    task = raise_task(client_as(MEMBER), team["id"], stage="act")

    response = patch_item(client_as(STRANGER), team["id"], "tasks", task["id"], summary="Mine")

    assert response.status_code == 403
    assert error_of(response) == (None, "auth.forbidden")
