"""Requirement: A team's leader sets its meeting schedule."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of
from tests.integration.teams_api import add, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
SCHEDULE = {"weekday": 3, "time": "13:00"}


def test_a_leader_sets_the_schedule_of_their_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)

    response = client_as(LEADER).put(f"/teams/{team['id']}/schedule", json=SCHEDULE)

    assert response.status_code == 200
    assert response.json()["board"]["schedule"] == SCHEDULE


def test_an_ordinary_member_cannot_set_the_schedule(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: An ordinary member cannot set the schedule - neither leader nor deputy."""
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)

    response = client_as(MEMBER).put(f"/teams/{team['id']}/schedule", json=SCHEDULE)

    assert response.status_code == 403
    assert error_of(response) == (None, "auth.forbidden")
    assert meetings_of(client, team["id"])["schedule"] is None


def test_an_administrator_sets_any_teams_schedule(client: TestClient) -> None:
    team = register(client, "Platform", LEADER)

    response = client.put(f"/teams/{team['id']}/schedule", json=SCHEDULE)

    assert response.status_code == 200
