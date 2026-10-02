"""One test per scenario of "Hand over the leadership of a team" in team-membership/spec.md."""

import threading
import time
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import Employee, Team, TeamMember
from app.services import add_member, change_leader, register_team
from tests.integration.teams_api import LEADER_EMAIL, add, leaders, member_id, register

pytestmark = pytest.mark.integration


def test_leadership_passes_to_another_member(client: TestClient) -> None:
    """Scenario: Leadership passes to another member."""
    team = register(client)
    jan = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")

    response = client.put(f"/teams/{team['id']}/leader", json={"employee_id": jan})

    assert response.status_code == 200
    body = response.json()
    assert leaders(body) == ["jan@example.com"]
    assert [m["email"] for m in body["members"]] == ["jan@example.com", LEADER_EMAIL]


def test_the_current_leader_is_made_leader_again(client: TestClient) -> None:
    """Scenario: The current leader is made leader again."""
    team = register(client)
    before = add(client, team["id"], "jan@example.com")

    response = client.put(f"/teams/{team['id']}/leader", json={"employee_id": team["leader"]["id"]})

    assert response.status_code == 200
    assert response.json() == before


def test_the_new_leader_is_not_a_member(client: TestClient) -> None:
    """Scenario: The new leader is not a member."""
    team = register(client, "Platform")
    other = register(client, "Quality")
    outsider = member_id(add(client, other["id"], "jan@example.com"), "jan@example.com")

    response = client.put(f"/teams/{team['id']}/leader", json={"employee_id": outsider})

    assert response.status_code == 409
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("employee_id", "team_leader.not_member")
    assert leaders(client.get(f"/teams/{team['id']}").json()) == [LEADER_EMAIL]


def test_leadership_of_a_team_that_does_not_exist(client: TestClient) -> None:
    """Scenario: Leadership of a team that does not exist."""
    response = client.put(f"/teams/{uuid.uuid4()}/leader", json={"employee_id": str(uuid.uuid4())})

    assert response.status_code == 404
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == (None, "team.not_found")


@pytest.fixture
def committed_team(engine: Engine) -> Iterator[dict[str, Any]]:
    """A team with a leader and two members, committed for real.

    The concurrent handovers need two connections, which cannot see the
    per-test rollback transaction, so this writes outside it and removes
    what it wrote afterwards.
    """
    suffix = uuid.uuid4().hex[:8]
    emails = [f"{who}.{suffix}@example.com" for who in ("lead", "anna", "bart")]
    with Session(engine) as session:
        team = register_team(session, f"Concurrent {suffix}", emails[0])
        add_member(session, team.id, emails[1])
        add_member(session, team.id, emails[2])
        ids = {m.email: m.employee_id for m in team.members}
        team_id = team.id
    try:
        yield {"team_id": team_id, "anna": ids[emails[1]], "bart": ids[emails[2]]}
    finally:
        with Session(engine) as session:
            session.execute(sa.delete(Team).where(Team.id == team_id))
            session.execute(sa.delete(Employee).where(Employee.email.in_(emails)))
            session.commit()


def test_concurrent_handovers_leave_one_leader(
    engine: Engine, committed_team: dict[str, Any]
) -> None:
    """Scenario: Concurrent handovers leave one leader.

    The first handover is paused right after it has read the members, so the
    second starts while the first still holds its view of the old leader.
    Without the lock on the team, the second would read that same old leader
    and one of the two commits would fail on the one-leader index.
    """
    team_id = committed_team["team_id"]
    first_has_read = threading.Event()
    failures: list[BaseException] = []

    def pause_after_reading_members(*args: Any) -> None:
        if "FROM team_members" in str(args[2]) and not first_has_read.is_set():
            first_has_read.set()
            time.sleep(0.5)

    def hand_over(employee_id: uuid.UUID, pause: bool) -> None:
        try:
            with engine.connect() as connection, Session(bind=connection) as session:
                if pause:
                    sa.event.listen(connection, "after_cursor_execute", pause_after_reading_members)
                else:
                    first_has_read.wait(timeout=5)
                change_leader(session, team_id, employee_id)
        except BaseException as error:
            failures.append(error)

    first = threading.Thread(target=hand_over, args=(committed_team["anna"], True))
    second = threading.Thread(target=hand_over, args=(committed_team["bart"], False))
    first.start()
    second.start()
    first.join(timeout=10)
    second.join(timeout=10)

    assert failures == []
    with Session(engine) as session:
        led_by = session.scalars(
            sa.select(TeamMember.employee_id).where(
                TeamMember.team_id == team_id, TeamMember.is_leader
            )
        ).all()
        member_count = session.scalar(
            sa.select(sa.func.count()).where(TeamMember.team_id == team_id)
        )
    assert len(led_by) == 1
    assert led_by[0] in {committed_team["anna"], committed_team["bart"]}
    assert member_count == 3
