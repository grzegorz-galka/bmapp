"""One test per scenario of "Propose the date of the next meeting". No I/O."""

import datetime

from app.models import WeeklySchedule
from app.services.meetings import propose_next

WEDNESDAYS_AT_ONE = WeeklySchedule(weekday=3, time=datetime.time(13, 0))
MONDAY = datetime.date(2026, 10, 12)
WEDNESDAY = datetime.date(2026, 10, 14)
THURSDAY = datetime.date(2026, 10, 15)
WEEK = datetime.timedelta(days=7)


def test_today_is_the_scheduled_weekday_and_its_meeting_is_not_yet_opened() -> None:
    # The proposal does not look at the clock: 13:00 having passed changes nothing.
    assert propose_next(WEDNESDAYS_AT_ONE, set(), WEDNESDAY) == (WEDNESDAY, datetime.time(13, 0))


def test_this_weeks_meeting_is_already_opened() -> None:
    assert propose_next(WEDNESDAYS_AT_ONE, {WEDNESDAY}, WEDNESDAY) == (
        WEDNESDAY + WEEK,
        datetime.time(13, 0),
    )


def test_several_weeks_are_prepared_ahead() -> None:
    taken = {WEDNESDAY, WEDNESDAY + WEEK}

    assert propose_next(WEDNESDAYS_AT_ONE, taken, MONDAY) == (
        WEDNESDAY + 2 * WEEK,
        datetime.time(13, 0),
    )


def test_a_meeting_off_the_schedule_does_not_block_the_proposal() -> None:
    assert propose_next(WEDNESDAYS_AT_ONE, {THURSDAY}, MONDAY) == (
        WEDNESDAY,
        datetime.time(13, 0),
    )


def test_a_board_without_a_schedule() -> None:
    assert propose_next(None, set(), MONDAY) is None


def test_the_proposal_wraps_into_next_week() -> None:
    assert propose_next(WEDNESDAYS_AT_ONE, set(), THURSDAY) == (
        WEDNESDAY + WEEK,
        datetime.time(13, 0),
    )
