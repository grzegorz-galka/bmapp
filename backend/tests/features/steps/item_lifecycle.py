"""Step definitions for item_lifecycle.feature.

They call the pure lifecycle rule directly - no database, no HTTP - because
that is where the rule lives and what the problems and tasks services call.
The item here is the few fields the rule decides, nothing more.
"""

import datetime
from dataclasses import dataclass, field

from pytest_bdd import given, parsers, then, when

from app.core.item_enums import Stage
from app.services.item_lifecycle import apply_stage, meeting_of_the_moment

DATE = r"\d{4}-\d{2}-\d{2}"
STAGE = r"not_started|plan|do|check|act"


@dataclass(frozen=True)
class Meeting:
    date: datetime.date


@dataclass
class Item:
    """An item as far as its lifecycle goes."""

    stage: Stage
    raised_at: datetime.datetime
    raised_meeting: Meeting | None
    closed_at: datetime.datetime | None = None
    closed_meeting: Meeting | None = None


@dataclass
class Team:
    """The team's calendar and the item the scenario follows."""

    today: datetime.date = datetime.date(2026, 10, 12)
    meetings: list[Meeting] = field(default_factory=list)
    item: Item | None = None
    #: Each change is a moment later than the last, so "the same time" is never a fluke.
    ticks: int = 0

    def now(self) -> datetime.datetime:
        self.ticks += 1
        start = datetime.datetime.combine(self.today, datetime.time(9), tzinfo=datetime.UTC)
        return start + datetime.timedelta(minutes=self.ticks)

    def raise_item(self, stage: Stage) -> Item:
        now = self.now()
        meeting = meeting_of_the_moment(self.meetings, self.today)
        closed_at, closed_meeting = apply_stage(None, stage, now, meeting)
        self.item = Item(stage, now, meeting, closed_at, closed_meeting)
        return self.item

    def change(self, stage: Stage) -> None:
        item = self.the_item()
        meeting = meeting_of_the_moment(self.meetings, self.today)
        closed = apply_stage(item.closed_at, stage, self.now(), meeting)
        item.closed_at, item.closed_meeting = closed
        item.stage = stage

    def the_item(self) -> Item:
        assert self.item is not None
        return self.item


def _date(text: str) -> datetime.date:
    return datetime.date.fromisoformat(text)


@given(parsers.re(rf"today is \w+ (?P<day>{DATE})"), target_fixture="team")
def today_is(day: str) -> Team:
    return Team(today=_date(day))


@given(parsers.re(rf"the team meets on (?P<first>{DATE}) and (?P<second>{DATE})"))
def meets_on(team: Team, first: str, second: str) -> None:
    team.meetings = [Meeting(_date(first)), Meeting(_date(second))]


@given("the team has opened no meeting")
def no_meetings(team: Team) -> None:
    team.meetings = []


@given(parsers.re(rf"an? (?:problem|task) at (?P<stage>{STAGE})"), target_fixture="team")
def item_at(stage: str) -> Team:
    team = Team()
    team.raise_item(Stage(stage))
    return team


@given(parsers.re(rf"a task raised then at (?P<stage>{STAGE})"))
def item_raised_then(team: Team, stage: str) -> None:
    team.raise_item(Stage(stage))


@when(parsers.re(rf"it is changed to (?P<stage>{STAGE})"))
def changed_to(team: Team, stage: str) -> None:
    team.change(Stage(stage))


@when(parsers.re(rf"two members both change it to (?P<stage>{STAGE}), one after the other"))
def changed_twice(team: Team, stage: str) -> None:
    team.change(Stage(stage))
    team.change(Stage(stage))


@when(parsers.re(rf"a task is raised at (?P<stage>{STAGE})"), target_fixture="team")
def raised_at_stage(stage: str) -> Team:
    team = Team()
    team.raise_item(Stage(stage))
    return team


@when(parsers.re(r"a member raises an? (?:problem|task)"))
def member_raises(team: Team) -> None:
    team.raise_item(Stage.NOT_STARTED)


@then(parsers.re(rf"it is at (?P<stage>{STAGE})"))
def is_at(team: Team, stage: str) -> None:
    assert team.the_item().stage is Stage(stage)


@then("it is still active")
def still_active(team: Team) -> None:
    item = team.the_item()
    assert (item.closed_at, item.closed_meeting) == (None, None)


@then("it is archived")
def archived(team: Team) -> None:
    assert team.the_item().closed_at is not None


@then("it records when it was closed")
def records_when_closed(team: Team) -> None:
    item = team.the_item()
    assert item.closed_at is not None and item.closed_at > item.raised_at


@then("it was raised and closed at the same time")
def raised_and_closed_together(team: Team) -> None:
    item = team.the_item()
    assert item.closed_at == item.raised_at


@then(parsers.re(rf"it was raised at the meeting on (?P<day>{DATE})"))
def raised_at_meeting(team: Team, day: str) -> None:
    assert team.the_item().raised_meeting == Meeting(_date(day))


@then("it was raised at no meeting")
def raised_at_no_meeting(team: Team) -> None:
    assert team.the_item().raised_meeting is None


@then(parsers.re(rf"it was closed at the meeting on (?P<day>{DATE})"))
def closed_at_meeting(team: Team, day: str) -> None:
    assert team.the_item().closed_meeting == Meeting(_date(day))
