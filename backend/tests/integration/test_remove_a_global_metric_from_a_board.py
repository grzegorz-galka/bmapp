"""One test per scenario of "Remove a global metric from a board".

In specs/global-metrics/spec.md.
"""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Metric
from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    board_of,
    freeze_today,
    metrics_of,
    put_value,
    record,
)
from tests.integration.teams_api import register

LEADER = "lead@pse.pl"


@pytest.fixture
def two_boards(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> tuple[str, str, str]:
    """Two teams whose boards both include one global metric; today is Monday the 12th."""
    freeze_today(monkeypatch)
    team = register(client, "Platform", LEADER)
    other = register(client, "Billing", "lead.billing@example.com")
    availability = seed_global_metric(session)
    include(client, team["id"], availability)
    include(client, other["id"], availability)
    return team["id"], other["id"], availability


def test_a_global_metric_without_values_on_the_board_is_removed(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    session: Session,
    two_boards: tuple[str, str, str],
) -> None:
    """Scenario: A global metric without values on the board is removed."""
    team_id, other_id, availability = two_boards
    theirs = open_meeting(client, other_id, "2026-10-14")
    record(client, other_id, theirs["id"], availability, value="99.8")

    response = client_as(LEADER).delete(f"/teams/{team_id}/metrics/{availability}")

    assert response.status_code == 204
    assert metrics_of(client, team_id) == []
    assert session.get(Metric, uuid.UUID(availability)) is not None
    assert [m["id"] for m in metrics_of(client, other_id)] == [availability]
    assert board_of(client, other_id, theirs["id"])["metrics"][0]["value"] == "99.8"
    include(client_as(LEADER), team_id, availability)


def test_removing_a_global_metric_with_values_on_the_board_is_refused(
    client: TestClient, client_as: Callable[[str], TestClient], two_boards: tuple[str, str, str]
) -> None:
    """Scenario: Removing a global metric with values on the board is refused."""
    team_id, _, availability = two_boards
    meeting = open_meeting(client, team_id, "2026-10-14")
    record(client, team_id, meeting["id"], availability, value="99.1")

    response = client_as(LEADER).delete(f"/teams/{team_id}/metrics/{availability}")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric.has_values")
    assert [m["id"] for m in metrics_of(client, team_id)] == [availability]


def test_a_global_metric_is_retired_on_one_board(
    client: TestClient, client_as: Callable[[str], TestClient], two_boards: tuple[str, str, str]
) -> None:
    """Scenario: A global metric is retired on one board."""
    team_id, other_id, availability = two_boards
    ours = open_meeting(client, team_id, "2026-10-14")
    theirs = open_meeting(client, other_id, "2026-10-14")

    response = client_as(LEADER).patch(
        f"/teams/{team_id}/metrics/{availability}", json={"retired": True}
    )

    assert response.status_code == 200
    assert response.json()["retired"] is True
    assert [(m["retired"], m["retired_in_catalogue"]) for m in metrics_of(client, team_id)] == [
        (True, False)
    ]
    assert [m["retired"] for m in metrics_of(client, other_id)] == [False]
    assert board_of(client, team_id, ours["id"])["metrics"] == []
    assert put_value(client, team_id, ours["id"], availability, value="99").status_code == 409
    record(client, other_id, theirs["id"], availability, value="99.8")
    [shown] = board_of(client, other_id, theirs["id"])["metrics"]
    assert (shown["metric"]["id"], shown["value"]) == (availability, "99.8")
