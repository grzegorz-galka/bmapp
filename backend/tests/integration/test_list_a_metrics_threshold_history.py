"""One test per scenario of "List a metric's threshold history" in specs/metrics/spec.md."""

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.metrics_api import add_metric, add_threshold, thresholds_of
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
