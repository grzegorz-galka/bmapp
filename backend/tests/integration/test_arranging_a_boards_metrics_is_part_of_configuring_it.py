"""Requirement: Arranging a board's metrics is part of configuring it."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    groups_of,
    metrics_of,
    placement,
    put_layout,
)
from tests.integration.teams_api import add, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"


def test_a_leader_arranges_their_board(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: A leader arranges their board."""
    team = register(client, "Platform", LEADER)
    metric = add_metric(client, team["id"], "Bugs")
    leader = client_as(LEADER)
    groups = f"/teams/{team['id']}/metric-groups"

    added = leader.post(groups, json={"name": "Qualty"})
    group_id = added.json()["id"]
    renamed = leader.patch(f"{groups}/{group_id}", json={"name": "Quality"})
    arranged = put_layout(leader, team["id"], [(group_id, [metric["id"]])], [])
    listed = metrics_of(client, team["id"])
    deleted = leader.delete(f"{groups}/{group_id}")

    assert [r.status_code for r in (added, renamed, arranged, deleted)] == [201, 200, 204, 204]
    assert placement(listed[0]) == ("Quality", 0)
    assert groups_of(client, team["id"]) == []


def test_an_ordinary_member_cannot_arrange_the_board(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: An ordinary member cannot arrange the board."""
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)
    group = add_group(client, team["id"], "Quality")
    metric = add_metric(client, team["id"], "Bugs", group_id=group["id"])
    member = client_as(MEMBER)
    groups = f"/teams/{team['id']}/metric-groups"

    responses = [
        member.post(groups, json={"name": "Finance"}),
        member.patch(f"{groups}/{group['id']}", json={"name": "Renamed"}),
        member.delete(f"{groups}/{group['id']}"),
        put_layout(member, team["id"], [(group["id"], [])], [metric["id"]]),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (403, (None, "auth.forbidden"))
    ] * 4
    assert groups_of(client, team["id"]) == [group]
    assert metrics_of(client, team["id"]) == [metric]


def test_an_administrator_arranges_any_board(client: TestClient) -> None:
    """Scenario: An administrator arranges any board."""
    team = register(client, "Platform", LEADER)
    group = add_group(client, team["id"], "Quality")
    metric = add_metric(client, team["id"], "Bugs")

    response = put_layout(client, team["id"], [(group["id"], [metric["id"]])], [])

    assert response.status_code == 204
    assert placement(metrics_of(client, team["id"])[0]) == ("Quality", 0)
