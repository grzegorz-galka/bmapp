"""Requirement: Only an administrator may register a team or change who leads it."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BoardDefinition, Employee, Team, TeamMember
from tests.conftest import ADMIN_EMAIL
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
OUTSIDER = "someone.else@pse.pl"


def counts(session: Session) -> tuple[int, ...]:
    session.expire_all()
    return tuple(
        session.scalar(select(func.count()).select_from(model)) or 0
        for model in (Team, BoardDefinition, Employee, TeamMember)
    )


def test_an_administrator_registers_a_team(client: TestClient) -> None:
    body = register(client, "Platform", LEADER)
    assert body["leader"]["email"] == LEADER


def test_a_non_administrator_registers_a_team(
    client_as: Callable[[str], TestClient], session: Session
) -> None:
    before = counts(session)

    response = client_as(OUTSIDER).post("/teams", json={"name": "Platform", "leader_email": LEADER})

    assert response.status_code == 403
    assert response.json()["errors"][0]["code"] == "auth.forbidden"
    assert counts(session) == before, "nothing may be created by a refused registration"


def test_an_unauthenticated_caller_registers_a_team(
    anonymous_client: TestClient, session: Session
) -> None:
    before = counts(session)

    response = anonymous_client.post("/teams", json={"name": "Platform", "leader_email": LEADER})

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"
    assert counts(session) == before


def test_a_leader_cannot_hand_over_their_own_leadership(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Who runs a team is the organization's decision, not the leader's."""
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], OUTSIDER)
    successor = member_id(detail, OUTSIDER)

    response = client_as(LEADER).put(f"/teams/{team['id']}/leader", json={"employee_id": successor})

    assert response.status_code == 403
    assert response.json()["errors"][0]["code"] == "auth.forbidden"
    after = client_as(LEADER).get(f"/teams/{team['id']}").json()
    assert [m["email"] for m in after["members"] if m["is_leader"]] == [LEADER]


def test_an_ordinary_member_cannot_hand_over_leadership(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], OUTSIDER)

    response = client_as(OUTSIDER).put(
        f"/teams/{team['id']}/leader", json={"employee_id": member_id(detail, OUTSIDER)}
    )

    assert response.status_code == 403


def test_an_administrator_hands_over_leadership(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    detail = add(client, team["id"], OUTSIDER)

    response = client_as(ADMIN_EMAIL).put(
        f"/teams/{team['id']}/leader", json={"employee_id": member_id(detail, OUTSIDER)}
    )

    assert response.status_code == 200
    assert [m["email"] for m in response.json()["members"] if m["is_leader"]] == [OUTSIDER]


def test_an_administrator_need_not_be_a_recorded_employee(
    client: TestClient, session: Session
) -> None:
    """The first team can be registered on a database with nothing in it."""
    session.expire_all()
    assert (
        session.scalar(
            select(func.count()).select_from(Employee).where(Employee.email == ADMIN_EMAIL)
        )
        == 0
    )

    body = register(client, "Platform", LEADER)

    assert body["leader"]["email"] == LEADER
