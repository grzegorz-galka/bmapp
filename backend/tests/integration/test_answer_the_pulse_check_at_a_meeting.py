"""One test per scenario of "Answer the pulse check at a meeting" in specs/pulse-check/spec.md."""

import datetime
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.pulse_api import answer, freeze_today, put_answer, results_of
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"
OTHER = "other@example.com"

ClientAs = Callable[[str], TestClient]
Board = tuple[str, str, dict[str, Any]]


@pytest.fixture
def board(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> Board:
    """A team with two members, and its next meeting."""
    freeze_today(monkeypatch)
    team = register(client)
    add(client, team["id"], MEMBER)
    detail = add(client, team["id"], OTHER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    return team["id"], meeting["id"], detail


def test_a_member_answers(client_as: ClientAs, board: Board) -> None:
    """Scenario: A member answers."""
    team_id, meeting_id, detail = board
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)

    recorded = answer(client_as(MEMBER), team_id, meeting_id, 4, positive="Release went out")

    assert {k: recorded[k] for k in ("rating", "positive", "negative", "better")} == {
        "rating": 4,
        "positive": "Release went out",
        "negative": "",
        "better": "",
    }
    assert (recorded["employee_id"], recorded["email"]) == (member_id(detail, MEMBER), MEMBER)
    assert datetime.datetime.fromisoformat(recorded["updated_at"]) >= before


def test_an_answer_is_replaced(client: TestClient, client_as: ClientAs, board: Board) -> None:
    """Scenario: An answer is replaced."""
    team_id, meeting_id, _ = board
    member = client_as(MEMBER)
    answer(member, team_id, meeting_id, 4, positive="Release went out")

    replaced = answer(member, team_id, meeting_id, 2)

    assert (replaced["rating"], replaced["positive"]) == (2, "")
    answers = results_of(client, team_id, meeting_id)["answers"]
    assert [(a["email"], a["rating"]) for a in answers] == [(MEMBER, 2)]


def test_each_member_answers_for_themselves(
    client: TestClient, client_as: ClientAs, board: Board
) -> None:
    """Scenario: Each member answers for themselves."""
    team_id, meeting_id, _ = board

    answer(client_as(MEMBER), team_id, meeting_id, 5)
    answer(client_as(OTHER), team_id, meeting_id, 3)

    answers = results_of(client, team_id, meeting_id)["answers"]
    assert [(a["email"], a["rating"]) for a in answers] == [(MEMBER, 5), (OTHER, 3)]


@pytest.mark.parametrize("rating", [None, 0, 6, 3.5])
def test_a_rating_out_of_range(
    client: TestClient, client_as: ClientAs, board: Board, rating: Any
) -> None:
    """Scenario: A rating out of range."""
    team_id, meeting_id, _ = board
    body = {} if rating is None else {"rating": rating}

    response = client_as(MEMBER).put(f"/teams/{team_id}/meetings/{meeting_id}/pulse/me", json=body)

    assert response.status_code == 422
    assert error_of(response) == ("rating", "pulse_rating.out_of_range")
    assert results_of(client, team_id, meeting_id)["answered"] == 0


@pytest.mark.parametrize("field", ["positive", "negative", "better"])
def test_a_text_that_is_too_long(
    client: TestClient, client_as: ClientAs, board: Board, field: str
) -> None:
    """Scenario: A text that is too long."""
    team_id, meeting_id, _ = board

    response = put_answer(client_as(MEMBER), team_id, meeting_id, 4, **{field: "x" * 2001})

    assert response.status_code == 422
    assert error_of(response) == (field, "pulse_text.too_long")
    assert results_of(client, team_id, meeting_id)["answered"] == 0


def test_blank_texts_are_stored_as_empty(client_as: ClientAs, board: Board) -> None:
    """Scenario: Blank texts are stored as empty."""
    team_id, meeting_id, _ = board

    recorded = answer(client_as(MEMBER), team_id, meeting_id, 3, negative="   ", better="\t ")

    assert (recorded["negative"], recorded["better"]) == ("", "")


def test_the_meeting_belongs_to_another_team(
    client: TestClient, client_as: ClientAs, board: Board
) -> None:
    """Scenario: The meeting belongs to another team."""
    team_id, _, _ = board
    other_team = register(client, "Payments")
    foreign = open_meeting(client, other_team["id"], "2026-10-14")

    response = put_answer(client_as(MEMBER), team_id, foreign["id"], 4)

    assert response.status_code == 404
    assert error_of(response) == (None, "meeting.not_found")
