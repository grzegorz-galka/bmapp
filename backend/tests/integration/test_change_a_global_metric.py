"""One test per scenario of "Change a global metric" in specs/global-metrics/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_api import (
    add_global,
    add_global_threshold,
    catalogue,
    global_thresholds_of,
    include,
)
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    freeze_today,
    metrics_of,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.teams_api import register


def test_a_rename_shows_on_every_board(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A rename shows on every board."""
    freeze_today(monkeypatch)
    metric = add_global(client, "Availability")
    add_global_threshold(client, metric["id"], green="99", amber="98")
    teams = [register(client, n, f"lead.{n.lower()}@example.com") for n in ("Alpha", "Beta")]
    for team in teams:
        include(session, team["id"], metric["id"])
        meeting = open_meeting(client, team["id"], "2026-10-14")
        record(client, team["id"], meeting["id"], metric["id"], value="99.5")
    history = global_thresholds_of(client, metric["id"])
    trends = [trend_of(client, team["id"], metric["id"]) for team in teams]

    response = client.patch(f"/global-metrics/{metric['id']}", json={"name": "Uptime"})

    assert response.status_code == 200
    assert response.json()["name"] == "Uptime"
    assert response.json()["boards"] == 2
    for team, trend in zip(teams, trends, strict=True):
        assert [m["name"] for m in metrics_of(client, team["id"])] == ["Uptime"]
        assert trend_of(client, team["id"], metric["id"])["points"] == trend["points"]
        assert thresholds_of(client, team["id"], metric["id"]) == history
    assert global_thresholds_of(client, metric["id"]) == history


def test_a_rename_that_clashes_on_an_including_board(client: TestClient, session: Session) -> None:
    """Scenario: A rename that clashes on an including board."""
    metric = add_global(client, "Availability")
    clashing = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    include(session, clashing["id"], metric["id"])
    include(session, other["id"], metric["id"])
    add_metric(client, clashing["id"], "uptime")
    # Another global metric's name is taken too, whatever the letter case.
    add_global(client, "Latency")

    response = client.patch(f"/global-metrics/{metric['id']}", json={"name": "Uptime"})
    against_global = client.patch(f"/global-metrics/{metric['id']}", json={"name": "LATENCY"})

    assert (response.status_code, error_of(response)) == (409, ("name", "metric_name.duplicate"))
    assert (against_global.status_code, error_of(against_global)) == (
        409,
        ("name", "metric_name.duplicate"),
    )
    assert [m["name"] for m in catalogue(client)] == ["Availability", "Latency"]


def test_changing_the_direction_of_a_global_metric_is_refused(client: TestClient) -> None:
    """Scenario: Changing the direction of a global metric is refused."""
    metric = add_global(client, "Availability", direction="higher_is_better")

    response = client.patch(
        f"/global-metrics/{metric['id']}",
        json={"name": "Uptime", "direction": "lower_is_better"},
    )

    assert response.status_code == 409
    assert error_of(response) == ("direction", "metric_direction.immutable")
    assert catalogue(client) == [metric]
