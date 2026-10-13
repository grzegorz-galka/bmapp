"""Requirement: A leader deputy stands in for the leader.

One test per scenario in specs/authorization/spec.md. Every actor but the
fixture's administrator is someone who is not an administrator.
"""

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of
from tests.integration.metrics_api import metrics_of, thresholds_of
from tests.integration.teams_api import LEADER_EMAIL, add, appoint, leaders, member_id, register

ClientAs = Callable[[str], TestClient]

DEPUTY = "deputy@pse.pl"
MEMBER = "member@pse.pl"
NEWCOMER = "newcomer@pse.pl"
SCHEDULE = {"weekday": 3, "time": "13:00"}
THRESHOLD = {"effective_from": "2026-10-01", "reason": "Plan", "green": "95", "amber": "85"}


def team_with_deputy(client: TestClient, name: str = "Platform") -> Any:
    """A team led by `LEADER_EMAIL` with `DEPUTY` as its deputy; returns its detail."""
    team = register(client, name)
    detail = add(client, team["id"], DEPUTY)
    return appoint(client, team["id"], member_id(detail, DEPUTY))


def test_a_deputy_configures_the_board(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A deputy configures the board."""
    team = team_with_deputy(client)
    deputy = client_as(DEPUTY)

    metric = deputy.post(
        f"/teams/{team['id']}/metrics", json={"name": "Revenue", "direction": "higher_is_better"}
    )
    threshold = deputy.post(
        f"/teams/{team['id']}/metrics/{metric.json()['id']}/thresholds", json=THRESHOLD
    )
    schedule = deputy.put(f"/teams/{team['id']}/schedule", json=SCHEDULE)

    assert (metric.status_code, threshold.status_code, schedule.status_code) == (201, 201, 200)
    assert [
        v["recorded_by_email"] for v in thresholds_of(client, team["id"], metric.json()["id"])
    ] == [DEPUTY]
    assert meetings_of(client, team["id"])["schedule"] == SCHEDULE


def test_a_deputy_manages_ordinary_members(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A deputy manages ordinary members."""
    team = team_with_deputy(client)
    add(client, team["id"], MEMBER)
    deputy = client_as(DEPUTY)

    added = deputy.post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})
    removed = deputy.delete(f"/teams/{team['id']}/members/{member_id(added.json(), MEMBER)}")

    assert (added.status_code, removed.status_code) == (201, 200)
    assert [m["email"] for m in removed.json()["members"]] == [
        DEPUTY,
        LEADER_EMAIL,
        NEWCOMER,
    ]


def test_a_deputy_cannot_hand_over_the_leadership(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A deputy cannot hand over the leadership."""
    team = team_with_deputy(client)

    response = client_as(DEPUTY).put(
        f"/teams/{team['id']}/leader", json={"employee_id": member_id(team, DEPUTY)}
    )

    assert (response.status_code, error_of(response)) == (403, (None, "auth.forbidden"))
    assert leaders(client.get(f"/teams/{team['id']}").json()) == [LEADER_EMAIL]


def test_a_deputys_authority_does_not_reach_another_team(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: A deputy's authority does not reach another team."""
    theirs = team_with_deputy(client, "Platform")
    not_theirs = register(client, "Billing", "lead.billing@pse.pl")
    add(client, not_theirs["id"], DEPUTY)
    deputy = client_as(DEPUTY)
    body = {"name": "Revenue", "direction": "higher_is_better"}

    refused = deputy.post(f"/teams/{not_theirs['id']}/metrics", json=body)
    permitted = deputy.post(f"/teams/{theirs['id']}/metrics", json=body)

    assert (refused.status_code, error_of(refused)) == (403, (None, "auth.forbidden"))
    assert metrics_of(client, not_theirs["id"]) == []
    assert permitted.status_code == 201


def test_revoking_a_deputy_removes_the_authority(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Revoking a deputy removes the authority."""
    team = team_with_deputy(client)
    revoked = client.delete(f"/teams/{team['id']}/deputies/{member_id(team, DEPUTY)}")
    assert revoked.status_code == 200

    response = client_as(DEPUTY).put(f"/teams/{team['id']}/schedule", json=SCHEDULE)

    assert (response.status_code, error_of(response)) == (403, (None, "auth.forbidden"))
    assert meetings_of(client, team["id"])["schedule"] is None
