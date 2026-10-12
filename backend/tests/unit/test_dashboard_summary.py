"""The dashboard summary's pure parts: identities, badges, declarations and upcoming meetings.

Nothing here touches the database. What the dashboard reads from recorded
data is tested against PostgreSQL, in the integration tests.
"""

import datetime
import uuid

import pytest

from app.models import WeeklySchedule
from app.services.dashboard import DECLARATIONS, OpenedMeeting, identify, team_initials, upcoming
from app.services.meetings import to_instant

#: A Monday.
MONDAY = datetime.date(2026, 10, 12)
TEAM = uuid.uuid4()
WEDNESDAYS = WeeklySchedule(3, datetime.time(13, 0))


def _opened(day: datetime.date, time: datetime.time = datetime.time(9, 30)) -> OpenedMeeting:
    return OpenedMeeting(uuid.uuid4(), TEAM, to_instant(day, time), None)


@pytest.mark.parametrize(
    ("email", "initials"),
    [
        ("jan.kowalski@pse.pl", "JK"),
        ("anna_maria-nowak@pse.pl", "AM"),
        ("admin@example.com", "A"),
    ],
)
def test_initials_come_from_the_email(email: str, initials: str) -> None:
    assert identify(email).initials == initials


@pytest.mark.parametrize(
    ("name", "initials"),
    [("Platform Core", "PC"), ("payments", "PA"), ("Data plane team", "DP"), ("X", "X")],
)
def test_a_teams_badge_comes_from_its_name(name: str, initials: str) -> None:
    assert team_initials(name) == initials


def test_each_value_has_its_own_pictogram() -> None:
    icons = [value.icon for value in DECLARATIONS.values]

    assert icons == ["effectiveness", "passion", "innovation", "collaboration"]


class TestUpcoming:
    """Which of a team's meetings from today on are listed, or what is proposed."""

    def test_todays_and_the_next_are_listed_and_later_ones_are_not(self) -> None:
        today, next_week, later = (
            _opened(MONDAY),
            _opened(MONDAY + datetime.timedelta(days=7)),
            _opened(MONDAY + datetime.timedelta(days=14)),
        )

        plan = upcoming([today, next_week, later], WEDNESDAYS, MONDAY)

        assert plan.opened == [today, next_week]
        assert plan.proposed is None
        assert plan.next_meeting_at == today.starts_at

    def test_without_one_today_the_first_after_today_is_listed(self) -> None:
        coming = _opened(MONDAY + datetime.timedelta(days=3))
        later = _opened(MONDAY + datetime.timedelta(days=10))

        plan = upcoming([later, coming], WEDNESDAYS, MONDAY)

        assert plan.opened == [coming]
        assert plan.next_meeting_at == coming.starts_at

    def test_with_none_opened_the_schedule_proposes(self) -> None:
        plan = upcoming([], WEDNESDAYS, MONDAY)

        assert plan.opened == []
        assert plan.proposed == (datetime.date(2026, 10, 14), datetime.time(13, 0))
        assert plan.next_meeting_at == datetime.datetime(2026, 10, 14, 11, 0, tzinfo=datetime.UTC)

    def test_with_none_opened_and_no_schedule_there_is_nothing(self) -> None:
        plan = upcoming([], None, MONDAY)

        assert (plan.opened, plan.proposed, plan.next_meeting_at) == ([], None, None)
