"""One test per scenario of "The individual answers of a meeting" in specs/pulse-check/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, remove, results_of, team_of

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def board(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, list[str]]:
    """A team of three and its next meeting."""
    freeze_today(monkeypatch)
    team_id, emails = team_of(client, 3)
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]
    return team_id, meeting, emails


def test_answers_and_the_missing_members_are_listed(
    client: TestClient, client_as: ClientAs, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: Answers and the missing members are listed."""
    team_id, meeting, (lead, first, second) = board
    answer(client_as(second), team_id, meeting, 5, positive="Shipped", better="Fewer meetings")
    answer(client_as(lead), team_id, meeting, 2, negative="Outage")

    results = results_of(client, team_id, meeting)

    assert [
        (a["email"], a["rating"], a["status"], a["positive"], a["negative"], a["better"])
        for a in results["answers"]
    ] == [
        (lead, 2, "red", "", "Outage", ""),
        (second, 5, "green", "Shipped", "", "Fewer meetings"),
    ]
    assert [m["email"] for m in results["missing"]] == [first]
    assert results["missing_count"] == 1


def test_a_former_members_answer_stays(
    client: TestClient, client_as: ClientAs, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: A former member's answer stays."""
    team_id, meeting, (lead, first, second) = board
    answer(client_as(first), team_id, meeting, 5)
    answer(client_as(lead), team_id, meeting, 2)
    remove(client, team_id, first)

    results = results_of(client, team_id, meeting)

    assert [a["email"] for a in results["answers"]] == [lead, first]
    assert (results["answered"], results["members"], results["average"]) == (2, 2, "3.50")
    assert [m["email"] for m in results["missing"]] == [second]
