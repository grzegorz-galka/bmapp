"""Pulse answers are logged at INFO with ids and the respondent's email - never what they said."""

import logging
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today
from tests.integration.teams_api import LEADER_EMAIL, register

SECRETS = ("Burned out on the release", "Nobody reviews my code", "Stop the late calls")


def _messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    """The application's own messages, without the test client's request lines."""
    return [r.getMessage() for r in caplog.records if r.name.startswith("app.")]


def test_recording_and_replacing_an_answer_are_logged_without_what_it_says(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_today(monkeypatch)
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    leader = client_as(LEADER_EMAIL)
    positive, negative, better = SECRETS

    with caplog.at_level(logging.DEBUG):
        answer(leader, team["id"], meeting["id"], 2, positive=positive)
        answer(leader, team["id"], meeting["id"], 1, negative=negative, better=better)

    expected = (
        f"Pulse answer at meeting {meeting['id']} of team {team['id']} recorded by {LEADER_EMAIL}"
    )
    info = [
        r.getMessage()
        for r in caplog.records
        if r.levelno == logging.INFO and r.name.startswith("app.")
    ]
    assert info[-2:] == [expected, expected]
    assert not any(secret in message for message in _messages(caplog) for secret in SECRETS)
    assert not any("rating" in message.lower() for message in _messages(caplog))
