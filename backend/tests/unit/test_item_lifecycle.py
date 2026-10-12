"""The lifecycle rule problems and tasks share: meeting of the moment, closing, overdue. No I/O."""

import datetime
from dataclasses import dataclass

import pytest

from app.core.item_enums import Stage
from app.services.item_lifecycle import apply_stage, is_overdue, meeting_of_the_moment

#: A Monday.
TODAY = datetime.date(2026, 10, 12)
NOW = datetime.datetime(2026, 10, 12, 9, 30, tzinfo=datetime.UTC)


@dataclass(frozen=True)
class Meeting:
    name: str
    date: datetime.date


def _days(offset: int) -> datetime.date:
    return TODAY + datetime.timedelta(days=offset)


# --- The meeting of the moment -------------------------------------------------


def test_no_meetings() -> None:
    assert meeting_of_the_moment([], TODAY) is None


def test_only_past_meetings_give_the_latest() -> None:
    meetings = [Meeting("two weeks ago", _days(-12)), Meeting("last week", _days(-5))]

    assert meeting_of_the_moment(meetings, TODAY) == meetings[1]


def test_a_meeting_today() -> None:
    today = Meeting("today", TODAY)
    meetings = [Meeting("last week", _days(-7)), today, Meeting("next week", _days(7))]

    assert meeting_of_the_moment(meetings, TODAY) == today


def test_a_past_and_a_future_meeting_give_the_future_one() -> None:
    coming = Meeting("Wednesday", _days(2))

    assert meeting_of_the_moment([coming, Meeting("last week", _days(-5))], TODAY) == coming


def test_of_two_future_meetings_the_first() -> None:
    first = Meeting("Wednesday", _days(2))

    assert meeting_of_the_moment([Meeting("in a fortnight", _days(16)), first], TODAY) == first


# --- Closing -------------------------------------------------------------------


def test_closing_sets_when_and_where() -> None:
    meeting = Meeting("Wednesday", _days(2))

    assert apply_stage(None, Stage.ACT, NOW, meeting) == (NOW, meeting)


def test_closing_with_no_meetings_records_none() -> None:
    assert apply_stage(None, Stage.ACT, NOW, None) == (NOW, None)


@pytest.mark.parametrize("stage", [Stage.NOT_STARTED, Stage.PLAN, Stage.DO, Stage.CHECK])
def test_staying_active_leaves_both_empty(stage: Stage) -> None:
    assert apply_stage(None, stage, NOW, Meeting("Wednesday", _days(2))) == (None, None)


def test_moving_back_leaves_the_item_active() -> None:
    """From `check` to `plan`: the target stage is what counts, not the direction."""
    assert apply_stage(None, Stage.PLAN, NOW, Meeting("Wednesday", _days(2))) == (None, None)


def test_an_archived_item_has_no_next_stage() -> None:
    with pytest.raises(ValueError, match="archived"):
        apply_stage(NOW, Stage.DO, NOW, None)


# --- Overdue -------------------------------------------------------------------


def test_due_yesterday_is_overdue() -> None:
    assert is_overdue(_days(-1), None, TODAY) is True


def test_due_today_is_not_overdue() -> None:
    assert is_overdue(TODAY, None, TODAY) is False


def test_no_due_date_is_never_overdue() -> None:
    assert is_overdue(None, None, TODAY) is False


def test_a_closed_item_is_never_overdue() -> None:
    assert is_overdue(_days(-11), NOW, TODAY) is False
