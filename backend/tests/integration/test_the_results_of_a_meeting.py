"""One test per scenario of "The results of a meeting" in specs/pulse-check/spec.md."""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, results_of, team_of

ClientAs = Callable[[str], TestClient]


def _answer_all(
    client_as: ClientAs, team_id: str, meeting_id: str, emails: list[str], ratings: list[int]
) -> None:
    for email, rating in zip(emails, ratings, strict=False):
        answer(client_as(email), team_id, meeting_id, rating)


def test_results_are_summarised(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Results are summarised."""
    freeze_today(monkeypatch)
    team_id, emails = team_of(client, 11)
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]
    _answer_all(client_as, team_id, meeting, emails, [5, 4, 4, 4, 3, 3, 2])

    results = results_of(client, team_id, meeting)

    assert (results["answered"], results["members"]) == (7, 11)
    assert (results["average"], results["status"]) == ("3.57", "amber")
    assert results["distribution"] == {"1": 0, "2": 1, "3": 2, "4": 3, "5": 1}
    assert results["missing_count"] == 4


def test_the_change_since_the_previous_meeting_with_answers(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The change since the previous meeting with answers."""
    team_id, emails = team_of(client, 11)
    earlier, skipped, current = (
        open_meeting(client, team_id, date)["id"]
        for date in ("2026-09-30", "2026-10-07", "2026-10-14")
    )
    freeze_today(monkeypatch, datetime.date(2026, 9, 29))
    _answer_all(client_as, team_id, earlier, emails, [4, 4, 4, 4, 3])
    freeze_today(monkeypatch)
    _answer_all(client_as, team_id, current, emails, [5, 4, 4, 4, 3, 3, 2])

    results = results_of(client, team_id, current)

    assert results["previous"] == {"meeting_id": earlier, "date": "2026-09-30", "average": "3.80"}
    assert results["change"] == "-0.23"
    assert results_of(client, team_id, skipped)["answered"] == 0


def test_no_earlier_answers(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: No earlier answers."""
    freeze_today(monkeypatch)
    team_id, emails = team_of(client, 3)
    open_meeting(client, team_id, "2026-09-30")
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]
    _answer_all(client_as, team_id, meeting, emails, [4, 5])

    results = results_of(client, team_id, meeting)

    assert (results["previous"], results["change"]) == (None, None)


def test_nobody_has_answered_yet(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Nobody has answered yet."""
    freeze_today(monkeypatch)
    team_id, emails = team_of(client, 3)
    earlier = open_meeting(client, team_id, "2026-10-07")["id"]
    _answer_all(client_as, team_id, earlier, emails, [4])
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]

    results = results_of(client, team_id, meeting)

    assert (results["answered"], results["average"], results["status"]) == (0, None, "no_data")
    assert results["distribution"] == {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    assert (results["answers"], results["missing_count"]) == ([], 3)
    # The previous meeting with answers is named even so; only the change is withheld.
    assert (results["previous"]["meeting_id"], results["change"]) == (earlier, None)
