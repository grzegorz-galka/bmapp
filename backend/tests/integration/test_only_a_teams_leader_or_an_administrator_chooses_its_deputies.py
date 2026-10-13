"""Requirement: Only a team's leader or an administrator chooses its deputies.

One test per scenario in specs/authorization/spec.md.
"""

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import (
    LEADER_EMAIL,
    add,
    appoint,
    deputies,
    member_id,
    register,
)

ClientAs = Callable[[str], TestClient]

ANNA = "anna@pse.pl"
JAN = "jan@pse.pl"
MEMBER = "member@pse.pl"
FORBIDDEN = (403, (None, "auth.forbidden"))


def team_with_two_deputies(client: TestClient) -> Any:
    """A team led by `LEADER_EMAIL`, with deputies `ANNA` and `JAN` and ordinary `MEMBER`."""
    team = register(client)
    add(client, team["id"], ANNA)
    add(client, team["id"], JAN)
    detail = add(client, team["id"], MEMBER)
    appoint(client, team["id"], member_id(detail, ANNA))
    return appoint(client, team["id"], member_id(detail, JAN))


def test_a_leader_appoints_and_revokes_a_deputy(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A leader appoints and revokes a deputy."""
    team = register(client)
    jan = member_id(add(client, team["id"], JAN), JAN)
    leader = client_as(LEADER_EMAIL)

    appointed = leader.put(f"/teams/{team['id']}/deputies/{jan}")
    revoked = leader.delete(f"/teams/{team['id']}/deputies/{jan}")

    assert (appointed.status_code, revoked.status_code) == (200, 200)
    assert deputies(appointed.json()) == [JAN]
    assert deputies(revoked.json()) == []
    assert JAN in [m["email"] for m in revoked.json()["members"]]


def test_a_deputy_cannot_appoint_or_revoke_deputies(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: A deputy cannot appoint or revoke deputies."""
    team = team_with_two_deputies(client)
    anna = client_as(ANNA)
    base = f"/teams/{team['id']}/deputies"

    responses = [
        anna.put(f"{base}/{member_id(team, MEMBER)}"),
        anna.delete(f"{base}/{member_id(team, JAN)}"),
        anna.delete(f"{base}/{member_id(team, ANNA)}"),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [FORBIDDEN] * 3
    assert deputies(client.get(f"/teams/{team['id']}").json()) == [ANNA, JAN]


def test_a_deputy_cannot_remove_another_deputy(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A deputy cannot remove another deputy."""
    team = team_with_two_deputies(client)

    response = client_as(ANNA).delete(f"/teams/{team['id']}/members/{member_id(team, JAN)}")

    assert (response.status_code, error_of(response)) == FORBIDDEN
    assert client.get(f"/teams/{team['id']}").json() == team


def test_an_ordinary_member_cannot_appoint_a_deputy(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An ordinary member cannot appoint a deputy."""
    team = register(client)
    add(client, team["id"], JAN)
    detail = add(client, team["id"], MEMBER)
    member = client_as(MEMBER)
    base = f"/teams/{team['id']}/deputies"

    responses = [
        member.put(f"{base}/{member_id(detail, MEMBER)}"),
        member.put(f"{base}/{member_id(detail, JAN)}"),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [FORBIDDEN] * 2
    assert deputies(client.get(f"/teams/{team['id']}").json()) == []


def test_an_administrator_appoints_a_deputy_of_any_team(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: An administrator appoints a deputy of any team."""
    team = register(client)
    jan = member_id(add(client, team["id"], JAN), JAN)

    response = client_as(ADMIN_EMAIL).put(f"/teams/{team['id']}/deputies/{jan}")

    assert response.status_code == 200
    assert ADMIN_EMAIL not in [m["email"] for m in response.json()["members"]]
    assert deputies(response.json()) == [JAN]
