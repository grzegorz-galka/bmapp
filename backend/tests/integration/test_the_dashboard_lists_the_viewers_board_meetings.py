"""The API half of "The dashboard lists the viewer's board meetings" in specs/dashboard/spec.md.

One test per scenario, and one holding the recording progress equal to the
board's completeness. The figure for people owing data is held equal to the
board's in test_a_meetings_board_reports_how_many_owe_data.py. Today is
pinned to Monday 12 October 2026 in the organization's zone.
"""

import json
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import VIEWER, dashboard_of, freeze_today, team_with
from tests.integration.global_metrics_api import add_global
from tests.integration.meetings_api import open_meeting, set_schedule
from tests.integration.metrics_api import add_metric, board_of, record
from tests.integration.pulse_api import answer
from tests.integration.teams_api import member_id

ClientAs = Callable[[str], TestClient]


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def _row(meeting: Any) -> tuple[Any, ...]:
    return (
        meeting["team"],
        meeting["date"],
        meeting["start_time"],
        meeting["today"],
        meeting["host"],
        meeting["recorded"],
        meeting["total"],
        meeting["pulse_answered"],
        meeting["pulse_answers"],
        meeting["members"],
        meeting["owing"],
    )


def test_todays_and_the_next_meeting_are_listed(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Today's and the next meeting are listed."""
    team = team_with(client, "Platform", VIEWER)
    today = open_meeting(client, team["id"], "2026-10-12", "09:30")
    following = open_meeting(client, team["id"], "2026-10-19", "09:30")
    host = member_id(team, VIEWER)
    response = client.patch(
        f"/teams/{team['id']}/meetings/{today['id']}", json={"host_employee_id": host}
    )
    assert response.status_code == 200, response.json()
    lead_time = add_metric(client, team["id"], "Lead time")
    add_metric(client, team["id"], "Open bugs")
    record(client, team["id"], today["id"], lead_time["id"], value="3")
    answer(client_as(VIEWER), team["id"], today["id"])

    meetings = dashboard_of(client_as(VIEWER))["meetings"]

    assert [meeting["meeting_id"] for meeting in meetings] == [today["id"], following["id"]]
    # The leader has answered neither meeting's pulse check, and nobody owns
    # a metric, so today the leader owes data and next week both members do.
    assert [_row(meeting) for meeting in meetings] == [
        ("Platform", "2026-10-12", "09:30", True, VIEWER, 1, 2, True, 1, 2, 1),
        ("Platform", "2026-10-19", "09:30", False, None, 0, 2, False, 0, 2, 2),
    ]


def test_last_weeks_meeting_is_not_listed(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Last week's meeting is not listed."""
    scheduled = team_with(client, "Platform", VIEWER)
    set_schedule(client, scheduled["id"], weekday=3, time="13:00")
    open_meeting(client, scheduled["id"], "2026-10-11")
    unscheduled = team_with(client, "Payments", VIEWER)
    open_meeting(client, unscheduled["id"], "2026-10-11")

    meetings = dashboard_of(client_as(VIEWER))["meetings"]

    assert [(m["team"], m["meeting_id"], m["date"]) for m in meetings] == [
        ("Platform", None, "2026-10-14"),
    ]


def test_a_proposed_date_is_listed_as_not_yet_opened(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: A proposed date is listed as not yet opened."""
    team = team_with(client, "Platform", VIEWER)
    set_schedule(client, team["id"], weekday=3, time="13:00")
    add_metric(client, team["id"], "Lead time")

    (meeting,) = dashboard_of(client_as(VIEWER))["meetings"]

    assert meeting == {
        "team_id": team["id"],
        "team": "Platform",
        "meeting_id": None,
        "date": "2026-10-14",
        "start_time": "13:00",
        "starts_at": "2026-10-14T11:00:00Z",
        "today": False,
        "host": None,
        "recorded": None,
        "total": None,
        "pulse_answered": False,
        "pulse_answers": None,
        "members": None,
        "owing": None,
    }


def test_meetings_of_several_teams_are_interleaved(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Meetings of several teams are interleaved."""
    tuesday = team_with(client, "Alpha", VIEWER)
    open_meeting(client, tuesday["id"], "2026-10-13", "09:00")
    monday = team_with(client, "Beta", VIEWER)
    set_schedule(client, monday["id"], weekday=1, time="15:00")

    meetings = dashboard_of(client_as(VIEWER))["meetings"]

    assert [(m["team"], m["date"], m["today"]) for m in meetings] == [
        ("Beta", "2026-10-12", True),
        ("Alpha", "2026-10-13", False),
    ]


def test_recording_progress_and_the_pulse_check_are_stated_in_words(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: Recording progress and the pulse check are stated in words.

    The words are the frontend's; the summary carries the figures and the flag.
    """
    others = [f"member{i}@example.com" for i in range(4)]
    team = team_with(client, "Platform", VIEWER, *others)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    metrics = [add_metric(client, team["id"], f"Metric {i:02}") for i in range(14)]
    for metric in metrics[:12]:
        record(client, team["id"], meeting["id"], metric["id"], value="1")
    for email in others:
        answer(client_as(email), team["id"], meeting["id"])

    (row,) = dashboard_of(client_as(VIEWER))["meetings"]

    assert (row["recorded"], row["total"]) == (12, 14)
    assert (row["pulse_answers"], row["members"], row["pulse_answered"]) == (4, 6, False)


def test_the_people_owing_data_are_counted_not_named(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: The people owing data are counted, not named.

    The leader and the viewer have not answered, and Anna owns a metric with
    no number yet: three people.
    """
    anna = "anna@example.com"
    team = team_with(client, "Platform", VIEWER, anna)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    add_metric(client, team["id"], "Lead time", owner_employee_id=member_id(team, anna))

    (row,) = dashboard_of(client_as(VIEWER))["meetings"]

    assert (row["meeting_id"], row["owing"]) == (meeting["id"], 3)
    assert "@" not in json.dumps(row)


def test_nothing_is_coming_up(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Nothing is coming up."""
    team = team_with(client, "Platform", VIEWER)
    open_meeting(client, team["id"], "2026-10-05")

    assert dashboard_of(client_as(VIEWER))["meetings"] == []


def test_recording_progress_is_the_boards_completeness(
    client: TestClient, client_as: ClientAs
) -> None:
    """The dashboard's recorded/total equal the board's completeness for the same meeting.

    With a retired metric that has a value, a global metric included in the
    board, a comment without a number, and a value of another team's metric.
    """
    team = team_with(client, "Platform", VIEWER)
    other = team_with(client, "Payments")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    other_meeting = open_meeting(client, other["id"], "2026-10-14")
    recorded = add_metric(client, team["id"], "Lead time")
    commented = add_metric(client, team["id"], "Open bugs")
    add_metric(client, team["id"], "Deploys")
    retired = add_metric(client, team["id"], "Old metric")
    availability = add_global(client)
    response = client.post(
        f"/teams/{team['id']}/metrics/inclusions", json={"global_metric_id": availability["id"]}
    )
    assert response.status_code == 201, response.json()
    foreign = add_metric(client, other["id"], "Their metric")
    record(client, team["id"], meeting["id"], recorded["id"], value="3")
    record(client, team["id"], meeting["id"], commented["id"], comment="Waiting for data")
    record(client, team["id"], meeting["id"], retired["id"], value="7")
    record(client, team["id"], meeting["id"], availability["id"], value="99.5")
    record(client, other["id"], other_meeting["id"], foreign["id"], value="1")
    response = client.patch(f"/teams/{team['id']}/metrics/{retired['id']}", json={"retired": True})
    assert response.status_code == 200, response.json()

    (row,) = dashboard_of(client_as(VIEWER))["meetings"]
    completeness = board_of(client, team["id"], meeting["id"])["completeness"]

    assert (row["recorded"], row["total"]) == (completeness["recorded"], completeness["total"])
    assert (row["recorded"], row["total"]) == (2, 4)
