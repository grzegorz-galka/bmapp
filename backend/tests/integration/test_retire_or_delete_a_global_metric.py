"""One test per scenario of "Retire or delete a global metric" in specs/global-metrics/spec.md.

"A retired global metric cannot be included" is exercised with the inclusion
endpoint, in the tests of "Include a global metric in a board".
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_api import add_global, catalogue, include
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    board_of,
    freeze_today,
    metrics_of,
    put_value,
    record,
    trend_of,
)
from tests.integration.teams_api import register


def test_a_retired_global_metric_leaves_every_board(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A retired global metric leaves every board."""
    freeze_today(monkeypatch)
    metric = add_global(client, "Availability")
    boards = []
    for name, value in (("Alpha", "99.1"), ("Beta", "98.7")):
        team = register(client, name, f"lead.{name.lower()}@example.com")
        include(session, team["id"], metric["id"])
        meeting = open_meeting(client, team["id"], "2026-10-14")
        record(client, team["id"], meeting["id"], metric["id"], value=value)
        boards.append((team, meeting, value))

    response = client.patch(f"/global-metrics/{metric['id']}", json={"retired": True})

    assert response.status_code == 200
    assert response.json()["retired"] is True
    for team, meeting, value in boards:
        assert board_of(client, team["id"], meeting["id"])["metrics"] == []
        assert [
            (m["id"], m["retired"], m["retired_in_catalogue"])
            for m in metrics_of(client, team["id"])
        ] == [(metric["id"], True, True)]
        points = trend_of(client, team["id"], metric["id"])["points"]
        assert [p["value"] for p in points] == [value]
        refused = put_value(client, team["id"], meeting["id"], metric["id"], value="99.9")
        assert (refused.status_code, error_of(refused)) == (409, (None, "metric.retired"))
    # Brought back, it is on every board again.
    client.patch(f"/global-metrics/{metric['id']}", json={"retired": False})
    team, meeting, _ = boards[0]
    assert [t["metric"]["id"] for t in board_of(client, team["id"], meeting["id"])["metrics"]] == [
        metric["id"]
    ]


def test_a_global_metric_without_values_is_deleted(client: TestClient, session: Session) -> None:
    """Scenario: A global metric without values is deleted."""
    metric = add_global(client, "Availability")
    team = register(client)
    include(session, team["id"], metric["id"])

    response = client.delete(f"/global-metrics/{metric['id']}")

    assert response.status_code == 204
    assert catalogue(client) == []
    assert metrics_of(client, team["id"]) == []


def test_deleting_a_global_metric_with_values_is_refused(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Deleting a global metric with values is refused."""
    freeze_today(monkeypatch)
    metric = add_global(client, "Availability")
    # One board has a value, the other none: one value anywhere is enough.
    quiet = register(client, "Alpha", "lead.alpha@example.com")
    busy = register(client, "Beta", "lead.beta@example.com")
    include(session, quiet["id"], metric["id"])
    include(session, busy["id"], metric["id"])
    meeting = open_meeting(client, busy["id"], "2026-10-14")
    record(client, busy["id"], meeting["id"], metric["id"], value="99")
    before = catalogue(client)

    response = client.delete(f"/global-metrics/{metric['id']}")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric.has_values")
    assert catalogue(client) == before
    assert [m["id"] for m in metrics_of(client, quiet["id"])] == [metric["id"]]
