"""Requirement: A team's leader configures its metrics and thresholds."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, metrics_of, thresholds_of
from tests.integration.teams_api import add, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
THRESHOLD = {"effective_from": "2026-10-01", "reason": "Plan", "green": "95", "amber": "85"}


def test_a_leader_adds_a_metric_and_its_threshold(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: A leader adds a metric and its threshold."""
    team = register(client, "Platform", LEADER)
    leader = client_as(LEADER)

    metric = add_metric(leader, team["id"])
    response = leader.post(f"/teams/{team['id']}/metrics/{metric['id']}/thresholds", json=THRESHOLD)

    assert response.status_code == 201
    assert [v["recorded_by_email"] for v in thresholds_of(client, team["id"], metric["id"])] == [
        LEADER
    ]


def test_an_ordinary_member_cannot_configure_metrics(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: An ordinary member cannot configure metrics."""
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)
    metric = add_metric(client, team["id"])
    member = client_as(MEMBER)
    base = f"/teams/{team['id']}/metrics"

    responses = [
        member.post(base, json={"name": "Costs", "direction": "lower_is_better"}),
        member.patch(f"{base}/{metric['id']}", json={"name": "Renamed"}),
        member.patch(f"{base}/{metric['id']}", json={"retired": True}),
        member.delete(f"{base}/{metric['id']}"),
        member.post(f"{base}/{metric['id']}/thresholds", json=THRESHOLD),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (403, (None, "auth.forbidden"))
    ] * 5
    assert metrics_of(client, team["id"]) == [metric]
    assert thresholds_of(client, team["id"], metric["id"]) == []


def test_an_administrator_configures_any_teams_metrics(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: An administrator configures any team's metrics."""
    team = register(client, "Platform", LEADER)
    metric = add_metric(client_as(LEADER), team["id"])

    response = client.post(f"/teams/{team['id']}/metrics/{metric['id']}/thresholds", json=THRESHOLD)

    assert response.status_code == 201
