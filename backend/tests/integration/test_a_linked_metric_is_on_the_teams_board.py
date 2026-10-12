"""One test per scenario of "A linked metric is on the team's board"
in specs/problems-and-tasks/spec.md."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.items_api import (
    every_item,
    freeze_today,
    items_of,
    post_item,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric
from tests.integration.teams_api import register


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    freeze_today(monkeypatch)
    return register(client)


def test_a_metric_of_another_board(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: A metric of another board."""
    other = register(client, "Payments", "payments.lead@example.com")
    theirs = add_metric(client, other["id"], "Chargebacks")

    response = post_item(client, team["id"], "problems", "Flaky", metric_id=theirs["id"])

    assert response.status_code == 409
    assert error_of(response) == ("metric_id", "item_metric.not_on_board")
    assert every_item(client, team["id"], "problems") == []


def test_an_included_global_metric(
    client: TestClient, session: Session, team: dict[str, Any]
) -> None:
    """Scenario: An included global metric."""
    availability = seed_global_metric(session, "Service availability")
    include(client, team["id"], availability)

    task = raise_task(client, team["id"], metric_id=availability)

    assert task["metric"] == {"id": availability, "name": "Service availability"}


def test_the_metric_is_deleted(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: The metric is deleted."""
    metric = add_metric(client, team["id"], "Open bugs")
    problem = raise_problem(client, team["id"], metric_id=metric["id"])
    assert problem["metric"] == {"id": metric["id"], "name": "Open bugs"}

    response = client.delete(f"/teams/{team['id']}/metrics/{metric['id']}")

    assert response.status_code == 204
    [kept] = items_of(client, team["id"], "problems")
    assert (kept["id"], kept["metric"]) == (problem["id"], None)
