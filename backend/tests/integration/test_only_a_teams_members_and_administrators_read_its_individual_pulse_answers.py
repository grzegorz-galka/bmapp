"""One test per scenario of "Only a team's members and administrators read its individual
pulse answers" in specs/authorization/spec.md."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, remove, results_of, team_of

ClientAs = Callable[[str], TestClient]
#: Signed in, on no team.
STRANGER = "stranger@example.com"
AGGREGATES = ("answered", "members", "average", "status", "change", "distribution", "trend")


@pytest.fixture
def board(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> tuple[str, str, list[str]]:
    """A team of three, two of whom answered at its next meeting."""
    freeze_today(monkeypatch)
    team_id, emails = team_of(client, 3)
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]
    answer(client_as(emails[0]), team_id, meeting, 4, positive="Good week")
    answer(client_as(emails[1]), team_id, meeting, 2, negative="Outage")
    return team_id, meeting, emails


def _names(results: Any) -> tuple[list[str], list[str]]:
    return [a["email"] for a in results["answers"]], [m["email"] for m in results["missing"]]


def test_a_member_reads_the_answers_by_name(
    client_as: ClientAs, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: A member reads the answers by name."""
    team_id, meeting, emails = board

    results = results_of(client_as(emails[2]), team_id, meeting)

    assert _names(results) == (emails[:2], [emails[2]])


def test_an_administrator_reads_the_answers_by_name(
    client: TestClient, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: An administrator reads the answers by name."""
    team_id, meeting, emails = board

    results = results_of(client, team_id, meeting)

    assert _names(results) == (emails[:2], [emails[2]])


def test_a_stranger_reads_the_aggregates_only(
    client: TestClient, client_as: ClientAs, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: A stranger reads the aggregates only."""
    team_id, meeting, _ = board

    results = results_of(client_as(STRANGER), team_id, meeting)

    full = results_of(client, team_id, meeting)
    assert {k: results[k] for k in AGGREGATES} == {k: full[k] for k in AGGREGATES}
    assert (results["answered"], results["average"]) == (2, "3.00")
    assert (results["answers"], results["missing"], results["own"]) == (None, None, None)
    assert results["missing_count"] == 1


def test_a_former_member_reads_the_aggregates_only(
    client: TestClient, client_as: ClientAs, board: tuple[str, str, list[str]]
) -> None:
    """Scenario: A former member reads the aggregates only."""
    team_id, meeting, emails = board
    remove(client, team_id, emails[1])

    results = results_of(client_as(emails[1]), team_id, meeting)

    assert (results["answered"], results["average"]) == (2, "3.00")
    assert (results["answers"], results["missing"], results["own"]) == (None, None, None)
