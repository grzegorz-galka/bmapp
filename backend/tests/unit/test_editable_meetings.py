"""One test per scenario of "Only the latest held and the next meeting can be edited"
in specs/metric-values/spec.md, against the pure window rule."""

import datetime

from app.services.metric_values import editable_meetings

MONDAY = datetime.date(2026, 10, 12)
LAST_WEDNESDAY = datetime.date(2026, 10, 7)
WEDNESDAY = datetime.date(2026, 10, 14)
THURSDAY = datetime.date(2026, 10, 15)
NEXT_WEDNESDAY = datetime.date(2026, 10, 21)


def test_values_are_typed_in_before_the_meeting() -> None:
    """Scenario: Values are typed in before the meeting."""
    editable = editable_meetings([LAST_WEDNESDAY, WEDNESDAY], MONDAY)

    assert editable == {LAST_WEDNESDAY, WEDNESDAY}


def test_a_correction_the_day_after() -> None:
    """Scenario: A correction the day after."""
    editable = editable_meetings([LAST_WEDNESDAY, WEDNESDAY, NEXT_WEDNESDAY], THURSDAY)

    assert WEDNESDAY in editable


def test_an_older_meeting_is_frozen() -> None:
    """Scenario: An older meeting is frozen."""
    two_weeks_ago = datetime.date(2026, 9, 30)

    editable = editable_meetings([two_weeks_ago, LAST_WEDNESDAY, WEDNESDAY], MONDAY)

    assert two_weeks_ago not in editable


def test_meetings_prepared_further_ahead_are_frozen_until_their_turn() -> None:
    """Scenario: Meetings prepared further ahead are frozen until their turn."""
    editable = editable_meetings([WEDNESDAY, NEXT_WEDNESDAY], MONDAY)

    assert editable == {WEDNESDAY}


def test_a_meeting_today_counts_as_held() -> None:
    editable = editable_meetings([LAST_WEDNESDAY, WEDNESDAY, NEXT_WEDNESDAY], WEDNESDAY)

    assert editable == {WEDNESDAY, NEXT_WEDNESDAY}


def test_a_team_without_meetings_can_edit_none() -> None:
    assert editable_meetings([], MONDAY) == frozenset()
