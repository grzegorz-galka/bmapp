"""Requirement: A team's leader manages that team's membership."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
NEWCOMER = "newcomer@pse.pl"
STRANGER = "stranger@pse.pl"


def test_a_leader_adds_a_member_to_their_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)

    response = client_as(LEADER).post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})

    assert response.status_code == 201
    assert NEWCOMER in [m["email"] for m in response.json()["members"]]


def test_a_leader_removes_a_member_from_their_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], MEMBER)

    response = client_as(LEADER).delete(f"/teams/{team['id']}/members/{member_id(detail, MEMBER)}")

    assert response.status_code == 200
    assert MEMBER not in [m["email"] for m in response.json()["members"]]


def test_an_ordinary_member_cannot_add_a_member(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)

    response = client_as(MEMBER).post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})

    assert response.status_code == 403
    assert response.json()["errors"][0]["code"] == "auth.forbidden"
    after = client_as(MEMBER).get(f"/teams/{team['id']}").json()
    assert NEWCOMER not in [m["email"] for m in after["members"]]


def test_an_ordinary_member_cannot_remove_a_member(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], MEMBER)
    other = add(client, team["id"], NEWCOMER)

    response = client_as(MEMBER).delete(f"/teams/{team['id']}/members/{member_id(other, NEWCOMER)}")

    assert response.status_code == 403
    after = client_as(MEMBER).get(f"/teams/{team['id']}").json()
    assert NEWCOMER in [m["email"] for m in after["members"]]
    assert detail  # the leader's own membership is untouched


def test_a_stranger_cannot_change_membership(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)

    response = client_as(STRANGER).post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})

    assert response.status_code == 403
    after = client_as(STRANGER).get(f"/teams/{team['id']}").json()
    assert [m["email"] for m in after["members"]] == [LEADER]


def test_an_administrator_changes_the_membership_of_a_team_they_do_not_belong_to(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)

    response = client_as(ADMIN_EMAIL).post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})

    assert response.status_code == 201


def test_a_leaders_authority_does_not_reach_another_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """The same person leads one team and is a stranger to the other.

    This is what "no roles" means: if leadership were a property of the person
    it would travel with them, and the second call would succeed too.
    """
    theirs = register(client, "Platform", LEADER)
    not_theirs = register(client, "Payments", "other.lead@pse.pl")

    permitted = client_as(LEADER).post(f"/teams/{theirs['id']}/members", json={"email": NEWCOMER})
    refused = client_as(LEADER).post(f"/teams/{not_theirs['id']}/members", json={"email": NEWCOMER})

    assert (permitted.status_code, refused.status_code) == (201, 403)


def test_leadership_handed_over_takes_the_authority_with_it(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], MEMBER)
    client.put(f"/teams/{team['id']}/leader", json={"employee_id": member_id(detail, MEMBER)})

    now_permitted = client_as(MEMBER).post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})
    now_refused = client_as(LEADER).post(
        f"/teams/{team['id']}/members", json={"email": "another@pse.pl"}
    )

    assert (now_permitted.status_code, now_refused.status_code) == (201, 403)


def test_an_unauthenticated_caller_cannot_change_membership(
    client: TestClient, anonymous_client: TestClient
) -> None:
    team = register(client, "Platform", LEADER)

    response = anonymous_client.post(f"/teams/{team['id']}/members", json={"email": NEWCOMER})

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"
