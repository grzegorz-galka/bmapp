"""One test per scenario of "List a board's metrics" in specs/metrics/spec.md."""

import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric, seed_global_threshold
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, add_threshold, freeze_today, metrics_of
from tests.integration.teams_api import register


def test_metrics_are_returned_in_display_order(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Metrics are returned in display order."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    third = add_metric(client, team["id"], "C", position=3)
    add_metric(client, team["id"], "A", position=1)
    add_metric(client, team["id"], "B", position=2)
    add_threshold(client, team["id"], third["id"], "2026-01-01", green="95", amber="85")
    add_threshold(client, team["id"], third["id"], "2026-10-13", green="99", amber="90")

    metrics = metrics_of(client, team["id"])

    assert [m["position"] for m in metrics] == [1, 2, 3]
    assert {m["scope"] for m in metrics} == {"board"}
    assert [m["threshold"] for m in metrics[:2]] == [None, None]
    # In force today, not the one that takes effect tomorrow.
    assert (metrics[2]["threshold"]["green_lo"], metrics[2]["threshold"]["amber_lo"]) == (
        "95",
        "85",
    )


def test_equal_positions_are_ordered_by_name(client: TestClient) -> None:
    team = register(client)
    add_metric(client, team["id"], "beta")
    add_metric(client, team["id"], "Alpha")

    assert [m["name"] for m in metrics_of(client, team["id"])] == ["Alpha", "beta"]


def test_a_retired_metric_is_listed_as_retired(client: TestClient) -> None:
    """Scenario: A retired metric is listed as retired."""
    team = register(client)
    add_metric(client, team["id"], "Active")
    retired = add_metric(client, team["id"], "Retired")
    client.patch(f"/teams/{team['id']}/metrics/{retired['id']}", json={"retired": True})

    metrics = metrics_of(client, team["id"])

    assert {m["name"]: m["retired"] for m in metrics} == {"Active": False, "Retired": True}


def test_own_and_global_metrics_are_listed_together(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Own and global metrics are listed together."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    team = register(client)
    own = add_metric(client, team["id"], "Revenue", position=2)
    availability = seed_global_metric(session, "Service availability")
    seed_global_threshold(session, availability, "2026-01-01", green_lo="99.5", amber_lo="99")
    seed_global_threshold(session, availability, "2026-10-13", green_lo="99.9", amber_lo="99.5")
    include(client, team["id"], availability, position=1, group_label="Operations")

    first, second = metrics_of(client, team["id"])

    assert (first["id"], first["scope"], first["team_id"]) == (availability, "global", team["id"])
    assert (first["position"], first["group_label"]) == (1, "Operations")
    assert (first["threshold"]["green_lo"], first["threshold"]["amber_lo"]) == ("99.5", "99")
    assert (second["id"], second["scope"]) == (own["id"], "board")


def test_a_team_that_does_not_exist(client: TestClient) -> None:
    response = client.get(f"/teams/{uuid.uuid4()}/metrics")

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
