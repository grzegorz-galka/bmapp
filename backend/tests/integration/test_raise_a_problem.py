"""One test per scenario of "Raise a problem" in specs/problems-and-tasks/spec.md."""

import datetime
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.items_api import every_item, freeze_today, post_item, raise_problem
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """A team with one member beside its leader."""
    freeze_today(monkeypatch)
    team = register(client)
    return add(client, team["id"], MEMBER)


def test_a_problem_is_raised(client_as: ClientAs, team: dict[str, Any]) -> None:
    """Scenario: A problem is raised."""
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)

    problem = raise_problem(
        client_as(MEMBER), team["id"], "Builds are flaky", reason="Shared test database"
    )

    assert (problem["summary"], problem["reason"], problem["solution"]) == (
        "Builds are flaky",
        "Shared test database",
        "",
    )
    assert (problem["responsible"], problem["due_on"], problem["metric"]) == (None, None, None)
    assert (problem["stage"], problem["archived"], problem["overdue"]) == (
        "not_started",
        False,
        False,
    )
    assert datetime.datetime.fromisoformat(problem["raised_at"]) >= before
    assert (problem["team_id"], problem["closed_at"]) == (team["id"], None)


def test_a_problem_with_every_field(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A problem with every field."""
    metric = add_metric(client, team["id"], "Open bugs", direction="lower_is_better")
    responsible = member_id(team, MEMBER)

    problem = raise_problem(
        client,
        team["id"],
        "  Builds are flaky  ",
        reason="Shared test database",
        solution="One database per run",
        responsible_employee_id=responsible,
        due_on="2026-10-20",
        metric_id=metric["id"],
        stage="plan",
    )

    assert problem["summary"] == "Builds are flaky"
    assert (problem["reason"], problem["solution"]) == (
        "Shared test database",
        "One database per run",
    )
    assert problem["responsible"] == {"employee_id": responsible, "email": MEMBER}
    assert problem["due_on"] == "2026-10-20"
    assert problem["metric"] == {"id": metric["id"], "name": "Open bugs"}
    assert (problem["stage"], problem["archived"]) == ("plan", False)


@pytest.mark.parametrize("summary", [None, "", "   "])
def test_the_summary_is_missing_or_blank(
    client: TestClient, team: dict[str, Any], summary: str | None
) -> None:
    """Scenario: The summary is missing or blank."""
    response = post_item(client, team["id"], "problems", summary, reason="Shared test database")

    assert response.status_code == 422
    assert error_of(response) == ("summary", "item_summary.blank")
    assert every_item(client, team["id"], "problems") == []


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({"summary": "x" * 501}, ("summary", "item_summary.too_long")),
        ({"reason": "x" * 4001}, ("reason", "item_text.too_long")),
        ({"solution": "x" * 4001}, ("solution", "item_text.too_long")),
    ],
)
def test_a_text_is_too_long(
    client: TestClient,
    team: dict[str, Any],
    fields: dict[str, str],
    expected: tuple[str, str],
) -> None:
    """Scenario: A text is too long."""
    body = {"summary": "Builds are flaky", **fields}

    response = post_item(client, team["id"], "problems", **body)

    assert response.status_code == 422
    assert error_of(response) == expected
    assert every_item(client, team["id"], "problems") == []


def test_an_unknown_stage(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: An unknown stage."""
    response = post_item(client, team["id"], "problems", "Builds are flaky", stage="done")

    assert response.status_code == 422
    assert error_of(response) == ("stage", "request.invalid_field")


def test_the_team_does_not_exist(client: TestClient) -> None:
    """Scenario: The team does not exist."""
    response = post_item(client, str(uuid.uuid4()), "problems", "Builds are flaky")

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
