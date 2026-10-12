"""One test per scenario of "The responsible person is a member of the team"
in specs/problems-and-tasks/spec.md."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import (
    every_item,
    freeze_today,
    items_of,
    patch_item,
    post_item,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.pulse_api import remove
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"
OUTSIDER = "outsider@example.com"


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member, and an employee who belongs only to another team."""
    freeze_today(monkeypatch)
    other = register(client, "Payments", "payments.lead@example.com")
    add(client, other["id"], OUTSIDER)
    team = register(client)
    return add(client, team["id"], MEMBER)


def _outsider_id(client: TestClient) -> str:
    teams = client.get("/teams").json()
    payments = next(t for t in teams if t["name"] == "Payments")
    return member_id(client.get(f"/teams/{payments['id']}").json(), OUTSIDER)


def test_a_non_member_is_named_responsible(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A non-member is named responsible."""
    outsider = _outsider_id(client)
    task = raise_task(client, team["id"], responsible_employee_id=member_id(team, MEMBER))

    raised = post_item(client, team["id"], "problems", "Flaky", responsible_employee_id=outsider)
    changed = patch_item(client, team["id"], "tasks", task["id"], responsible_employee_id=outsider)

    for response in (raised, changed):
        assert response.status_code == 409
        assert error_of(response) == ("responsible_employee_id", "item_responsible.not_member")
    assert every_item(client, team["id"], "problems") == []
    assert items_of(client, team["id"], "tasks") == [task]


def test_the_responsible_person_leaves_the_team(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: The responsible person leaves the team."""
    responsible = member_id(team, MEMBER)
    task = raise_task(client, team["id"], responsible_employee_id=responsible)

    remove(client, team["id"], MEMBER)

    [kept] = items_of(client, team["id"], "tasks")
    assert kept["responsible"] == {"employee_id": responsible, "email": MEMBER}
    assert kept == task
