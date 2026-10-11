"""Requirement: A team's leader configures its metrics and thresholds."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, metrics_of, thresholds_of
from tests.integration.teams_api import add, member_id, register

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
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: An ordinary member cannot configure metrics."""
    team = register(client, "Platform", LEADER)
    other = register(client, "Billing", "lead.billing@example.com")
    add(client, team["id"], MEMBER)
    metric = add_metric(client, team["id"])
    theirs = add_metric(client, other["id"], "Costs")
    availability = seed_global_metric(session)
    member = client_as(MEMBER)
    base = f"/teams/{team['id']}/metrics"

    responses = [
        member.post(base, json={"name": "Costs", "direction": "lower_is_better"}),
        member.patch(f"{base}/{metric['id']}", json={"name": "Renamed"}),
        member.patch(f"{base}/{metric['id']}", json={"retired": True}),
        member.delete(f"{base}/{metric['id']}"),
        member.post(f"{base}/{metric['id']}/thresholds", json=THRESHOLD),
        member.post(f"{base}/copies", json={"source_metric_id": theirs["id"]}),
        member.post(f"{base}/inclusions", json={"global_metric_id": availability}),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (403, (None, "auth.forbidden"))
    ] * 7
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


def test_a_leader_copies_from_a_board_they_do_not_belong_to(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: A leader copies from a board they do not belong to."""
    team = register(client, "Platform", LEADER)
    other = register(client, "Billing", "lead.billing@example.com")
    source = add_metric(client, other["id"], "Costs")
    leader = client_as(LEADER)
    body = {"source_metric_id": source["id"]}

    copied = leader.post(f"/teams/{team['id']}/metrics/copies", json=body)
    refused = leader.post(f"/teams/{other['id']}/metrics/copies", json={**body, "name": "Again"})

    assert copied.status_code == 201, copied.json()
    assert [m["name"] for m in metrics_of(client, team["id"])] == ["Costs"]
    assert (refused.status_code, error_of(refused)) == (403, (None, "auth.forbidden"))
    assert metrics_of(client, other["id"]) == [source]


def test_a_leader_includes_a_global_metric(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: A leader includes a global metric."""
    team = register(client, "Platform", LEADER)
    owner = member_id(add(client, team["id"], MEMBER), MEMBER)
    availability = seed_global_metric(session)
    leader = client_as(LEADER)

    include(leader, team["id"], availability, position=1)
    placed = leader.patch(
        f"/teams/{team['id']}/metrics/{availability}",
        json={"position": 2, "group_label": "Operations", "owner_employee_id": owner},
    )

    assert placed.status_code == 200, placed.json()
    [listed] = metrics_of(client, team["id"])
    assert (listed["scope"], listed["position"], listed["group_label"]) == (
        "global",
        2,
        "Operations",
    )
    assert listed["owner"]["email"] == MEMBER
