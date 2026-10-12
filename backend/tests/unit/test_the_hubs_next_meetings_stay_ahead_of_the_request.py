"""One test per scenario of "The hub's next meetings stay ahead of the request".

In specs/hub/spec.md. Pure, over the placeholder teams: nothing here touches the database.
"""

import datetime

import pytest

from app.services.hub import hub_teams, next_occurrence

THURSDAY = datetime.datetime(2026, 9, 17, 12, 0, tzinfo=datetime.UTC)

# One request moment per weekday, plus two either side of a slot's time of
# day, so the property is asserted across a whole week rather than at one
# convenient instant.
A_WEEK_OF_MOMENTS = [
    THURSDAY + datetime.timedelta(days=day, hours=hour) for day in range(7) for hour in (-4, 0, 4)
]


@pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
def test_next_meetings_are_always_ahead_of_the_request(now: datetime.datetime) -> None:
    """Scenario: Next meetings are always ahead of the request."""
    for team in hub_teams(now):
        assert team.next_meeting_at > now
        # The *next* occurrence: a week earlier would not have been ahead.
        assert team.next_meeting_at - datetime.timedelta(days=7) <= now


def test_a_meeting_later_today_has_not_already_passed() -> None:
    """Scenario: A meeting later today has not already passed.

    Thursday noon, asking for the Thursday 09:30 slot: this morning's meeting
    is over, so the next one is a week away.
    """
    occurrence = next_occurrence(4, datetime.time(9, 30), THURSDAY)

    assert occurrence == datetime.datetime(2026, 9, 24, 9, 30, tzinfo=datetime.UTC)
