"""Requirement: Only an administrator defines global metrics."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.global_metrics_api import add_global, catalogue, global_thresholds_of
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import register

LEADER = "lead@pse.pl"
THRESHOLD = {"effective_from": "2026-10-01", "reason": "Plan", "green": "99.5", "amber": "99"}


def test_an_administrator_defines_a_global_metric_and_its_threshold(client: TestClient) -> None:
    """Scenario: An administrator defines a global metric and its threshold."""
    metric = add_global(client, "Service availability")

    response = client.post(f"/global-metrics/{metric['id']}/thresholds", json=THRESHOLD)

    assert response.status_code == 201
    assert [m["id"] for m in catalogue(client)] == [metric["id"]]
    assert [v["recorded_by_email"] for v in global_thresholds_of(client, metric["id"])] == [
        ADMIN_EMAIL
    ]


def test_a_leader_cannot_define_a_global_metric(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: A leader cannot define a global metric."""
    register(client, "Platform", LEADER)
    metric = add_global(client, "Service availability")
    before = catalogue(client)
    leader = client_as(LEADER)
    url = f"/global-metrics/{metric['id']}"

    responses = [
        leader.post("/global-metrics", json={"name": "Latency", "direction": "lower_is_better"}),
        leader.patch(url, json={"name": "Uptime"}),
        leader.patch(url, json={"retired": True}),
        leader.delete(url),
        leader.post(f"{url}/thresholds", json=THRESHOLD),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (403, (None, "auth.forbidden"))
    ] * 5
    # Reading stays open to them.
    assert catalogue(leader) == before
    assert global_thresholds_of(leader, metric["id"]) == []
