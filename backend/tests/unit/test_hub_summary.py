"""The hub summary's placeholder half: its date arithmetic and its teams.

Pure functions over constants, so none of this touches the database. What
the hub reads from the recorded problems and tasks - the funnel and the
assigned items - is tested against PostgreSQL, in the integration tests.
"""

import datetime

import pytest

from app.services.hub import hub_teams, next_occurrence

# A Thursday, so that "today" can be moved forwards and backwards from a
# weekday every slot in the fixture can be compared against.
THURSDAY = datetime.datetime(2026, 9, 17, 12, 0, tzinfo=datetime.UTC)

# One request moment per weekday, plus two either side of a slot's time of
# day, so the properties below are asserted across a whole week rather than
# at one convenient instant.
A_WEEK_OF_MOMENTS = [
    THURSDAY + datetime.timedelta(days=day, hours=hour) for day in range(7) for hour in (-4, 0, 4)
]


class TestNextOccurrence:
    """The next occurrence of a weekly slot, strictly after a given moment."""

    def test_returns_a_later_day_this_week(self) -> None:
        # Thursday noon, asking for the Saturday slot.
        occurrence = next_occurrence(6, datetime.time(9, 30), THURSDAY)

        assert occurrence == datetime.datetime(2026, 9, 19, 9, 30, tzinfo=datetime.UTC)

    def test_returns_today_when_the_slot_is_still_ahead(self) -> None:
        # Thursday noon, asking for the Thursday 14:00 slot.
        occurrence = next_occurrence(4, datetime.time(14, 0), THURSDAY)

        assert occurrence == datetime.datetime(2026, 9, 17, 14, 0, tzinfo=datetime.UTC)

    def test_returns_next_week_when_the_slot_is_exactly_now(self) -> None:
        # A meeting starting this instant is the one happening, not the one
        # still to come.
        occurrence = next_occurrence(4, datetime.time(12, 0), THURSDAY)

        assert occurrence == datetime.datetime(2026, 9, 24, 12, 0, tzinfo=datetime.UTC)

    def test_wraps_to_a_weekday_earlier_in_the_week(self) -> None:
        # Thursday noon, asking for the Tuesday slot.
        occurrence = next_occurrence(2, datetime.time(11, 0), THURSDAY)

        assert occurrence == datetime.datetime(2026, 9, 22, 11, 0, tzinfo=datetime.UTC)

    @pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
    @pytest.mark.parametrize("weekday", range(1, 8))
    def test_is_always_the_requested_weekday_and_always_ahead(
        self, weekday: int, now: datetime.datetime
    ) -> None:
        time_of_day = datetime.time(9, 30)

        occurrence = next_occurrence(weekday, time_of_day, now)

        assert occurrence > now
        assert occurrence.isoweekday() == weekday
        assert occurrence.timetz() == time_of_day.replace(tzinfo=datetime.UTC)
        # The *next* occurrence: a week earlier would not have been.
        assert occurrence - datetime.timedelta(days=7) <= now


class TestHubTeams:
    """The caller's teams, still placeholder data."""

    @pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
    def test_orders_teams_by_their_next_meeting(self, now: datetime.datetime) -> None:
        meetings = [team.next_meeting_at for team in hub_teams(now)]

        assert meetings == sorted(meetings)

    def test_a_ready_board_carries_no_count_and_a_missing_one_does(self) -> None:
        readiness = {team.readiness.code: team.readiness for team in hub_teams(THURSDAY)}

        assert readiness["ready"].count is None
        assert readiness["metrics_missing"].count is not None

    def test_next_meetings_are_instants_in_utc(self) -> None:
        for team in hub_teams(THURSDAY):
            assert team.next_meeting_at.utcoffset() == datetime.timedelta(0)
