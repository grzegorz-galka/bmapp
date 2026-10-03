"""The hub summary: its date arithmetic, its ordering, and its shape.

Pure functions over constants, so none of this touches the database.
"""

import datetime

import pytest

from app.schemas.hub import HubSummary, LocalizedText
from app.services.hub import build_hub_summary, next_occurrence

# A Thursday, so that "today" can be moved forwards and backwards from a
# weekday every slot in the fixture can be compared against.
#: Whoever the summary is built for. The identity is the one real thing
#: in the payload; everything else is still placeholder data.
SIGNED_IN = "jan.kowalski@pse.pl"

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

    def test_returns_next_week_when_today_s_slot_has_passed(self) -> None:
        # Thursday noon, asking for the Thursday 09:30 slot: this morning's
        # meeting is over, so the next one is a week away.
        occurrence = next_occurrence(4, datetime.time(9, 30), THURSDAY)

        assert occurrence == datetime.datetime(2026, 9, 24, 9, 30, tzinfo=datetime.UTC)

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


class TestBuildHubSummary:
    """The assembled payload."""

    def test_is_built_from_the_declared_constants(self) -> None:
        # The seeds cover every field the schema declares, or this raises.
        summary = build_hub_summary(THURSDAY, SIGNED_IN)

        assert isinstance(summary, HubSummary)
        assert summary.teams
        assert summary.assigned_items
        assert summary.funnel.stages

    def test_marks_itself_provisional(self) -> None:
        assert build_hub_summary(THURSDAY, SIGNED_IN).provisional is True

    @pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
    def test_orders_teams_by_their_next_meeting(self, now: datetime.datetime) -> None:
        teams = build_hub_summary(now, SIGNED_IN).teams

        meetings = [team.next_meeting_at for team in teams]
        assert meetings == sorted(meetings)

    @pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
    def test_every_next_meeting_is_ahead_of_the_request(self, now: datetime.datetime) -> None:
        for team in build_hub_summary(now, SIGNED_IN).teams:
            assert team.next_meeting_at > now

    @pytest.mark.parametrize("now", A_WEEK_OF_MOMENTS)
    def test_always_has_an_overdue_item_and_an_item_still_to_come(
        self, now: datetime.datetime
    ) -> None:
        today = now.date()

        due_dates = [item.due_on for item in build_hub_summary(now, SIGNED_IN).assigned_items]

        assert any(due < today for due in due_dates)
        assert any(due >= today for due in due_dates)


class TestPayloadShape:
    """The rules the spec puts on the payload, asserted over the whole of it."""

    @staticmethod
    def _localized_texts(summary: HubSummary) -> list[LocalizedText]:
        declarations = summary.declarations
        return [
            declarations.mission,
            declarations.vision,
            *declarations.goals,
            *declarations.values,
            *(item.summary for item in summary.assigned_items),
        ]

    def test_every_prose_field_carries_both_languages(self) -> None:
        for text in self._localized_texts(build_hub_summary(THURSDAY, SIGNED_IN)):
            assert text.en.strip(), text
            assert text.pl.strip(), text

    def test_the_two_languages_are_not_the_same_text(self) -> None:
        # A catalogue wired to itself would otherwise pass the check above.
        for text in self._localized_texts(build_hub_summary(THURSDAY, SIGNED_IN)):
            assert text.en != text.pl, text

    def test_states_are_codes_from_the_fixed_sets(self) -> None:
        summary = build_hub_summary(THURSDAY, SIGNED_IN)

        for team in summary.teams:
            assert team.role in {"leader", "member"}
            assert team.readiness.code in {"ready", "metrics_missing"}
        for stage in summary.funnel.stages:
            assert stage.stage in {"open", "in_progress", "archived"}
        for item in summary.assigned_items:
            assert item.kind in {"problem", "task"}

    def test_a_ready_board_carries_no_count_and_a_missing_one_does(self) -> None:
        readiness = {
            team.readiness.code: team.readiness
            for team in build_hub_summary(THURSDAY, SIGNED_IN).teams
        }

        assert readiness["ready"].count is None
        assert readiness["metrics_missing"].count is not None

    def test_instants_are_utc_and_due_dates_are_plain_dates(self) -> None:
        summary = build_hub_summary(THURSDAY, SIGNED_IN)

        for team in summary.teams:
            assert team.next_meeting_at.tzinfo is not None
            assert team.next_meeting_at.utcoffset() == datetime.timedelta(0)
        for item in summary.assigned_items:
            # A date, not a datetime: `datetime` is a subclass of `date`.
            assert type(item.due_on) is datetime.date

    def test_serialises_instants_as_iso_8601_in_utc(self) -> None:
        body = build_hub_summary(THURSDAY, SIGNED_IN).model_dump(mode="json")

        for team in body["teams"]:
            assert team["next_meeting_at"].endswith("Z") or team["next_meeting_at"].endswith(
                "+00:00"
            )
        for item in body["assigned_items"]:
            assert datetime.date.fromisoformat(item["due_on"])

    def test_progress_is_a_percentage(self) -> None:
        for item in build_hub_summary(THURSDAY, SIGNED_IN).assigned_items:
            assert 0 <= item.progress <= 100
