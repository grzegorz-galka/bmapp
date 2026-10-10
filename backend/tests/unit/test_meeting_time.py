"""Wall-clock time in the organization's zone against UTC instants. No I/O.

Poland's clocks go forward on 2026-03-29 and back on 2026-10-25.
"""

import datetime

from app.services.meetings import to_instant, to_wall_clock

UTC = datetime.UTC
ONE_PM = datetime.time(13, 0)


def test_summer_time_is_two_hours_ahead_of_utc() -> None:
    assert to_instant(datetime.date(2026, 10, 14), ONE_PM) == datetime.datetime(
        2026, 10, 14, 11, 0, tzinfo=UTC
    )


def test_winter_time_is_one_hour_ahead_of_utc() -> None:
    assert to_instant(datetime.date(2026, 10, 28), ONE_PM) == datetime.datetime(
        2026, 10, 28, 12, 0, tzinfo=UTC
    )


def test_the_same_time_either_side_of_the_spring_change() -> None:
    before = to_instant(datetime.date(2026, 3, 25), ONE_PM)
    after = to_instant(datetime.date(2026, 4, 1), ONE_PM)

    assert (before.hour, after.hour) == (12, 11)
    assert to_wall_clock(before)[1] == to_wall_clock(after)[1] == ONE_PM


def test_a_time_skipped_in_spring_reads_with_the_winter_offset() -> None:
    # 02:30 does not exist on 2026-03-29; fold=0 takes it as 02:30 +01:00.
    assert to_instant(datetime.date(2026, 3, 29), datetime.time(2, 30)) == datetime.datetime(
        2026, 3, 29, 1, 30, tzinfo=UTC
    )


def test_a_time_repeated_in_autumn_is_its_first_occurrence() -> None:
    # 02:30 happens twice on 2026-10-25; fold=0 takes the first, at +02:00.
    assert to_instant(datetime.date(2026, 10, 25), datetime.time(2, 30)) == datetime.datetime(
        2026, 10, 25, 0, 30, tzinfo=UTC
    )


def test_a_late_evening_meeting_keeps_its_local_date() -> None:
    instant = to_instant(datetime.date(2026, 10, 14), datetime.time(23, 30))

    assert instant.date() == datetime.date(2026, 10, 14)
    assert to_instant(datetime.date(2026, 6, 1), datetime.time(0, 30)).date() == datetime.date(
        2026, 5, 31
    )
    assert to_wall_clock(to_instant(datetime.date(2026, 6, 1), datetime.time(0, 30))) == (
        datetime.date(2026, 6, 1),
        datetime.time(0, 30),
    )
