"""One test per scenario of "Only the latest held and the next meeting take answers"
in specs/pulse-check/spec.md, through the API with today fixed."""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.pulse_api import answer, freeze_today, put_answer, results_of
from tests.integration.teams_api import add, register

MEMBER = "member@example.com"

ClientAs = Callable[[str], TestClient]
Team = tuple[str, dict[str, str]]


@pytest.fixture
def team(client: TestClient) -> Team:
    """A team with a member, and weekly Wednesday meetings 30.09 to 21.10."""
    team = register(client)
    add(client, team["id"], MEMBER)
    meetings = {
        date: open_meeting(client, team["id"], date)["id"]
        for date in ("2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21")
    }
    return team["id"], meetings


def test_answering_before_the_meeting(
    client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Answering before the meeting."""
    team_id, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))
    member = client_as(MEMBER)

    statuses = [
        put_answer(member, team_id, meetings[d], 4).status_code
        for d in ("2026-10-07", "2026-10-14")
    ]

    assert statuses == [200, 200]


def test_an_older_meeting_is_frozen(
    client: TestClient, client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An older meeting is frozen."""
    team_id, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    answer(client_as(MEMBER), team_id, meetings["2026-10-07"], 4, positive="Calm week")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))

    response = put_answer(client_as(MEMBER), team_id, meetings["2026-10-07"], 1)

    assert response.status_code == 409
    assert error_of(response) == (None, "pulse_answer.meeting_frozen")
    [kept] = results_of(client, team_id, meetings["2026-10-07"])["answers"]
    assert (kept["rating"], kept["positive"]) == (4, "Calm week")


def test_a_meeting_further_ahead_is_not_yet_open(
    client_as: ClientAs, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A meeting further ahead is not yet open."""
    team_id, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))

    response = put_answer(client_as(MEMBER), team_id, meetings["2026-10-21"], 4)

    assert response.status_code == 409
    assert error_of(response) == (None, "pulse_answer.meeting_frozen")


def test_the_results_say_whether_the_meeting_takes_answers(
    client: TestClient, team: Team, monkeypatch: pytest.MonkeyPatch
) -> None:
    team_id, meetings = team
    freeze_today(monkeypatch, datetime.date(2026, 10, 12))

    editable = {d: results_of(client, team_id, m)["editable"] for d, m in meetings.items()}

    assert editable == {
        "2026-09-30": False,
        "2026-10-07": True,
        "2026-10-14": True,
        "2026-10-21": False,
    }
