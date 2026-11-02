"""One test per scenario of "List a metric's threshold history" in specs/metrics/spec.md."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import ADMIN_EMAIL
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    seed_version_before_target_values,
    thresholds_of,
)
from tests.integration.teams_api import register


def test_the_history_of_a_metrics_thresholds(client: TestClient) -> None:
    """Scenario: The history of a metric's thresholds."""
    team = register(client)
    metric = add_metric(client, team["id"])
    july = add_threshold(
        client, team["id"], metric["id"], "2026-07-01", "July", green="9", amber="8"
    )
    first = add_threshold(
        client, team["id"], metric["id"], "2026-09-01", "Sep", green="9", amber="7"
    )
    # Recorded later for the same date, so more recent than `first`.
    again = add_threshold(
        client, team["id"], metric["id"], "2026-09-01", "Fix", green="9", amber="6"
    )

    history = thresholds_of(client, team["id"], metric["id"])

    assert [v["id"] for v in history] == [again["id"], first["id"], july["id"]]
    assert [v["reason"] for v in history] == ["Fix", "Sep", "July"]
    assert {v["recorded_by_email"] for v in history} == {ADMIN_EMAIL}


def test_a_history_spanning_target_values(client: TestClient, session: Session) -> None:
    """Scenario: A history spanning target values."""
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    seed_version_before_target_values(
        session, metric["id"], "2026-07-01", green_lo="95", amber_lo="85"
    )
    later = add_threshold(
        client,
        team["id"],
        metric["id"],
        "2026-09-01",
        target_value="100",
        green_pct="5",
        amber_pct="10",
    )

    history = thresholds_of(client, team["id"], metric["id"])

    assert len(history) == 2
    assert history[0]["id"] == later["id"]
    fields = ("target_value", "green_pct", "amber_pct", "green_lo", "amber_lo")
    assert [{k: v[k] for k in fields} for v in history] == [
        {
            "target_value": "100",
            "green_pct": "5",
            "amber_pct": "10",
            "green_lo": "95",
            "amber_lo": "90",
        },
        {
            "target_value": None,
            "green_pct": None,
            "amber_pct": None,
            "green_lo": "95",
            "amber_lo": "85",
        },
    ]
