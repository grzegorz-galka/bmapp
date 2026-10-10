"""One test per scenario of "Name the host of a meeting" in specs/meetings/spec.md."""

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, meetings_of, open_meeting
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"
OUTSIDER = "outsider@example.com"


def _name_host(client: TestClient, team_id: str, meeting_id: str, host: str | None) -> object:
    return client.patch(f"/teams/{team_id}/meetings/{meeting_id}", json={"host_employee_id": host})


def test_a_member_is_named_host(client: TestClient) -> None:
    """Scenario: A member is named host."""
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = _name_host(client, team["id"], meeting["id"], host)

    assert response.status_code == 200
    assert response.json()["host"] == {"id": host, "email": MEMBER}


def test_someone_outside_the_team_is_named_host(client: TestClient) -> None:
    """Scenario: Someone outside the team is named host."""
    team = register(client)
    other = register(client, "Other", "lead.other@example.com")
    outsider = member_id(add(client, other["id"], OUTSIDER), OUTSIDER)
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = _name_host(client, team["id"], meeting["id"], outsider)

    assert response.status_code == 409
    assert error_of(response) == ("host_employee_id", "meeting_host.not_member")
    assert meetings_of(client, team["id"])["meetings"][0]["host"] is None


def test_the_host_is_cleared(client: TestClient) -> None:
    """Scenario: The host is cleared."""
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    _name_host(client, team["id"], meeting["id"], host)

    response = _name_host(client, team["id"], meeting["id"], None)

    assert response.status_code == 200
    assert response.json()["host"] is None


def test_a_change_that_leaves_out_the_host_keeps_it(client: TestClient) -> None:
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    _name_host(client, team["id"], meeting["id"], host)

    response = client.patch(f"/teams/{team['id']}/meetings/{meeting['id']}", json={"time": "15:00"})

    assert response.json()["host"]["email"] == MEMBER


def test_the_host_leaves_the_team(client: TestClient) -> None:
    """Scenario: The host leaves the team."""
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    _name_host(client, team["id"], meeting["id"], host)

    removed = client.delete(f"/teams/{team['id']}/members/{host}")

    assert removed.status_code == 200
    assert meetings_of(client, team["id"])["meetings"][0]["host"] == {"id": host, "email": MEMBER}
