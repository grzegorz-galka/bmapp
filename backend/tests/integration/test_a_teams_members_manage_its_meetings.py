"""Requirement: A team's members manage its meetings."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
STRANGER = "stranger@pse.pl"
OTHER_LEADER = "lead.other@pse.pl"
MEETING = {"date": "2026-10-14", "time": "13:00"}


def test_a_member_opens_a_meeting(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)

    response = client_as(MEMBER).post(f"/teams/{team['id']}/meetings", json=MEETING)

    assert response.status_code == 201


def test_a_member_changes_a_meeting(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    member = client_as(MEMBER)
    url = f"/teams/{team['id']}/meetings/{meeting['id']}"

    moved = member.patch(url, json={"date": "2026-10-15"})
    hosted = member.patch(url, json={"host_employee_id": host})
    deleted = member.delete(url)

    assert [moved.status_code, hosted.status_code, deleted.status_code] == [200, 200, 204]


def test_a_stranger_cannot_open_or_change_a_meeting(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    stranger = client_as(STRANGER)
    url = f"/teams/{team['id']}/meetings/{meeting['id']}"

    responses = [
        stranger.post(f"/teams/{team['id']}/meetings", json={**MEETING, "date": "2026-10-21"}),
        stranger.patch(url, json={"date": "2026-10-15"}),
        stranger.patch(url, json={"host_employee_id": host}),
        stranger.delete(url),
    ]

    assert [r.status_code for r in responses] == [403, 403, 403, 403]
    assert {error_of(r) for r in responses} == {(None, "auth.forbidden")}
    assert meetings_of(client, team["id"])["meetings"] == [meeting]


def test_a_member_of_another_team_cannot_manage_this_teams_meetings(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)
    own = register(client, "Other", OTHER_LEADER)
    other_leader = client_as(OTHER_LEADER)

    refused = other_leader.post(f"/teams/{team['id']}/meetings", json=MEETING)
    allowed = other_leader.post(f"/teams/{own['id']}/meetings", json=MEETING)

    assert (refused.status_code, allowed.status_code) == (403, 201)


def test_an_administrator_manages_any_teams_meetings(client: TestClient) -> None:
    team = register(client, "Platform", LEADER)

    response = client.post(f"/teams/{team['id']}/meetings", json=MEETING)

    assert response.status_code == 201
