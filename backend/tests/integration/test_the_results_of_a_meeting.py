"""One test per scenario of "The results of a meeting" and of "The viewer's answer at
another team's meeting that week" in specs/pulse-check/spec.md."""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import PulseAnswer
from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, results_of, team_of
from tests.integration.teams_api import add, register

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


#: A member of every team the tests below register, and its leaders.
BOTH = "both@example.com"
ALPHA_LEAD, BETA_LEAD, GAMMA_LEAD = (
    "lead.alpha@example.com",
    "lead.beta@example.com",
    "lead.gamma@example.com",
)


def _team_with_both(client: TestClient, name: str, leader: str) -> str:
    team_id: str = register(client, name, leader)["id"]
    add(client, team_id, BOTH)
    return team_id


def test_an_answer_at_another_teams_meeting_that_week_is_returned(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An answer at another team's meeting that week is returned."""
    freeze_today(monkeypatch)
    alpha = _team_with_both(client, "Alpha", ALPHA_LEAD)
    beta = _team_with_both(client, "Beta", BETA_LEAD)
    alpha_monday = open_meeting(client, alpha, "2026-10-12")["id"]
    beta_thursday = open_meeting(client, beta, "2026-10-15")["id"]
    member = client_as(BOTH)
    answer(member, alpha, alpha_monday, 4, positive="Pairing", negative="Noise", better="Focus")

    results = results_of(member, beta, beta_thursday)

    assert results["own"] is None
    elsewhere = results["elsewhere"]
    assert (elsewhere["rating"], elsewhere["positive"], elsewhere["negative"]) == (
        4,
        "Pairing",
        "Noise",
    )
    assert elsewhere["better"] == "Focus"
    assert elsewhere["team"] == {"id": alpha, "name": "Alpha"}
    assert elsewhere["meeting"] == {"id": alpha_monday, "date": "2026-10-12"}


def test_an_answer_in_another_week_is_not_returned(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An answer in another week is not returned."""
    freeze_today(monkeypatch, datetime.date(2026, 10, 5))
    alpha = _team_with_both(client, "Alpha", ALPHA_LEAD)
    beta = _team_with_both(client, "Beta", BETA_LEAD)
    # Exactly a week before Beta's Monday meeting: the previous ISO week.
    last_monday = open_meeting(client, alpha, "2026-10-05")["id"]
    beta_meeting = open_meeting(client, beta, "2026-10-12")["id"]
    member = client_as(BOTH)
    answer(member, alpha, last_monday, 4)

    assert results_of(member, beta, beta_meeting)["elsewhere"] is None


def _stamp(session: Session, meeting_id: str, at: datetime.datetime) -> None:
    """Set when the answers at a meeting were last changed.

    The whole test runs in one transaction, where `now()` never moves, so the
    order of changes has to be written in.
    """
    session.execute(
        update(PulseAnswer).where(PulseAnswer.meeting_id == meeting_id).values(updated_at=at)
    )
    session.commit()


def test_the_answer_changed_last_wins(
    client: TestClient, client_as: ClientAs, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The answer changed last wins."""
    freeze_today(monkeypatch)
    alpha = _team_with_both(client, "Alpha", ALPHA_LEAD)
    beta = _team_with_both(client, "Beta", BETA_LEAD)
    gamma = _team_with_both(client, "Gamma", GAMMA_LEAD)
    alpha_meeting = open_meeting(client, alpha, "2026-10-12")["id"]
    beta_meeting = open_meeting(client, beta, "2026-10-15")["id"]
    gamma_meeting = open_meeting(client, gamma, "2026-10-18")["id"]
    member = client_as(BOTH)
    # Gamma answered first, then Alpha, then Gamma changed: changed last, not
    # first answered, decides.
    answer(member, gamma, gamma_meeting, 2)
    answer(member, alpha, alpha_meeting, 4)
    answer(member, gamma, gamma_meeting, 3, positive="Changed")
    start = datetime.datetime(2026, 10, 12, 9, tzinfo=datetime.UTC)
    _stamp(session, alpha_meeting, start)
    _stamp(session, gamma_meeting, start + datetime.timedelta(hours=1))

    elsewhere = results_of(member, beta, beta_meeting)["elsewhere"]

    assert elsewhere["team"]["name"] == "Gamma"
    assert (elsewhere["rating"], elsewhere["positive"]) == (3, "Changed")


def test_nothing_is_offered_once_the_meeting_is_answered(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Nothing is offered once the meeting is answered."""
    freeze_today(monkeypatch)
    alpha = _team_with_both(client, "Alpha", ALPHA_LEAD)
    beta = _team_with_both(client, "Beta", BETA_LEAD)
    alpha_meeting = open_meeting(client, alpha, "2026-10-12")["id"]
    beta_meeting = open_meeting(client, beta, "2026-10-15")["id"]
    member = client_as(BOTH)
    answer(member, alpha, alpha_meeting, 4)
    answer(member, beta, beta_meeting, 5)

    results = results_of(member, beta, beta_meeting)

    assert (results["own"]["rating"], results["elsewhere"]) == (5, None)


def test_only_the_viewers_own_answer_is_returned(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Only the viewer's own answer is returned."""
    freeze_today(monkeypatch)
    alpha = _team_with_both(client, "Alpha", ALPHA_LEAD)
    beta = _team_with_both(client, "Beta", BETA_LEAD)
    viewer = "viewer@example.com"
    add(client, beta, viewer)
    alpha_meeting = open_meeting(client, alpha, "2026-10-12")["id"]
    beta_meeting = open_meeting(client, beta, "2026-10-15")["id"]
    answer(client_as(BOTH), alpha, alpha_meeting, 4, positive="Not yours")

    assert results_of(client_as(viewer), beta, beta_meeting)["elsewhere"] is None
