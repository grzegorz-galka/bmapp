"""Schedule and meeting changes are logged at INFO with ids and the acting email only."""

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import open_meeting, set_schedule
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"


def _messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    """The application's own INFO messages, without the test client's request lines."""
    return [
        r.getMessage()
        for r in caplog.records
        if r.levelno == logging.INFO and r.name.startswith("app.")
    ]


def test_setting_the_schedule_is_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    team = register(client)
    with caplog.at_level(logging.INFO):
        set_schedule(client, team["id"])

    assert f"Schedule of team {team['id']} set by {ADMIN_EMAIL}" in _messages(caplog)


def test_opening_changing_and_deleting_a_meeting_are_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    team = register(client)
    host = member_id(add(client, team["id"], MEMBER), MEMBER)
    with caplog.at_level(logging.INFO):
        meeting = open_meeting(client, team["id"], "2026-10-14")
        url = f"/teams/{team['id']}/meetings/{meeting['id']}"
        client.patch(url, json={"date": "2026-10-15"})
        client.patch(url, json={"host_employee_id": host})
        client.delete(url)

    prefix = f"Meeting {meeting['id']} of team {team['id']}"
    assert _messages(caplog)[-4:] == [
        f"{prefix} opened by {ADMIN_EMAIL}",
        f"{prefix} changed by {ADMIN_EMAIL}",
        f"{prefix} changed by {ADMIN_EMAIL}",
        f"{prefix} deleted by {ADMIN_EMAIL}",
    ]
    # The host's email is personal data the log has no need of.
    assert not any(MEMBER in message for message in _messages(caplog)[-4:])
