"""One test per scenario of "The trend of the pulse check" in specs/pulse-check/spec.md,
and the fixed number of statements the results take."""

import datetime
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, results_of, team_of
from tests.integration.teams_api import add, register

ClientAs = Callable[[str], TestClient]

#: Wednesdays, a week apart, the first on 2 September 2026.
FIRST_WEDNESDAY = datetime.date(2026, 9, 2)


def _weekly_meetings(
    client: TestClient,
    client_as: ClientAs,
    monkeypatch: pytest.MonkeyPatch,
    team_id: str,
    ratings_per_week: list[list[int]],
    emails: list[str],
) -> list[str]:
    """Open one meeting a week and have the members answer at each, the day before it."""
    meetings = []
    for week, ratings in enumerate(ratings_per_week):
        day = FIRST_WEDNESDAY + datetime.timedelta(weeks=week)
        meeting = open_meeting(client, team_id, day.isoformat())["id"]
        freeze_today(monkeypatch, day - datetime.timedelta(days=1))
        for email, rating in zip(emails, ratings, strict=False):
            answer(client_as(email), team_id, meeting, rating)
        meetings.append(meeting)
    return meetings


def test_meetings_without_answers_leave_no_point(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Meetings without answers leave no point."""
    team_id, emails = team_of(client, 3)
    meetings = _weekly_meetings(
        client, client_as, monkeypatch, team_id, [[4, 5], [], [3, 3, 2], [5]], emails
    )

    trend = results_of(client, team_id, meetings[-1])["trend"]

    assert trend == [
        {
            "meeting_id": meetings[0],
            "date": "2026-09-02",
            "average": "4.50",
            "status": "green",
            "answered": 2,
        },
        {
            "meeting_id": meetings[2],
            "date": "2026-09-16",
            "average": "2.67",
            "status": "red",
            "answered": 3,
        },
        {
            "meeting_id": meetings[3],
            "date": "2026-09-23",
            "average": "5.00",
            "status": "green",
            "answered": 1,
        },
    ]


def test_the_trend_stops_at_the_meeting_shown(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The trend stops at the meeting shown."""
    team_id, emails = team_of(client, 2)
    meetings = _weekly_meetings(
        client, client_as, monkeypatch, team_id, [[4], [3], [5], [2]], emails
    )

    trend = results_of(client, team_id, meetings[1])["trend"]

    assert [point["meeting_id"] for point in trend] == meetings[:2]


def test_the_trend_spans_the_last_16_meetings_with_answers(
    client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    team_id, emails = team_of(client, 1)
    meetings = _weekly_meetings(
        client, client_as, monkeypatch, team_id, [[1 + week % 5] for week in range(18)], emails
    )

    trend = results_of(client, team_id, meetings[-1])["trend"]

    assert [point["meeting_id"] for point in trend] == meetings[2:]


def _statements(session: Session, call: Any) -> int:
    count = 0

    def counted(*_: Any) -> None:
        nonlocal count
        count += 1

    connection = session.connection()
    event.listen(connection, "before_cursor_execute", counted)
    try:
        call()
    finally:
        event.remove(connection, "before_cursor_execute", counted)
    return count


def test_the_results_take_a_fixed_number_of_statements(
    client: TestClient, client_as: ClientAs, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    small_id, small_emails = team_of(client, 1)
    [small_meeting] = _weekly_meetings(
        client, client_as, monkeypatch, small_id, [[4]], small_emails
    )
    one = _statements(
        session, lambda: results_of(client_as(small_emails[0]), small_id, small_meeting)
    )

    big = register(client, "Payments", "lead.payments@example.com")
    emails = ["lead.payments@example.com"]
    for index in range(1, 11):
        email = f"payments{index:02}@example.com"
        add(client, big["id"], email)
        emails.append(email)
    meetings = _weekly_meetings(
        client,
        client_as,
        monkeypatch,
        big["id"],
        [[1 + (week + i) % 5 for i in range(11)] for week in range(16)],
        emails,
    )
    viewer = client_as(emails[3])

    sixteen = _statements(session, lambda: results_of(viewer, big["id"], meetings[-1]))

    results = results_of(viewer, big["id"], meetings[-1])
    assert (len(results["trend"]), len(results["answers"]), results["members"]) == (16, 11, 11)
    # The caller's employee lookup and membership, then the meeting, its
    # team's meeting dates, its answers, the team's members and the trend.
    assert one == sixteen == 7
