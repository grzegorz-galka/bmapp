"""Step definitions for metric_status.feature.

They call the pure status rule and the threshold resolver directly - no
database, no HTTP - because that is where the rule lives and what the board,
the trend and the API all call.
"""

import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from pytest_bdd import given, parsers, then, when

from app.core.metric_enums import Colour, Direction, Status
from app.services.metric_status import status_of, threshold_in_force

NUMBER = r"-?\d+(?:\.\d+)?"
DATE = r"\d{4}-\d{2}-\d{2}"

#: Far enough apart that "recorded later" is never a tie.
_FIRST_RECORDING = datetime.datetime(2026, 1, 1, 9, tzinfo=datetime.UTC)


@dataclass
class Version:
    """A threshold version as the resolver and the rule see it."""

    effective_from: datetime.date
    recorded_at: datetime.datetime
    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None
    name: str = ""


@dataclass
class Board:
    """What the scenario has set up and what it has judged."""

    direction: Direction = Direction.HIGHER_IS_BETTER
    versions: list[Version] = field(default_factory=list)
    value: Decimal | None = None
    manual: Colour | None = None
    meeting_date: datetime.date = datetime.date(2026, 10, 14)
    judged: list[Status] = field(default_factory=list)

    def add(self, effective_from: datetime.date, **bounds: Any) -> None:
        recorded_at = _FIRST_RECORDING + datetime.timedelta(hours=len(self.versions))
        self.versions.append(Version(effective_from, recorded_at, **bounds))

    def judge(self, value: Decimal | None, manual: Colour | None = None) -> Status:
        threshold = threshold_in_force(self.versions, self.meeting_date)
        return status_of(self.direction, value, manual, threshold)


def _one_sided(direction: Direction, green: str, amber: str) -> dict[str, Decimal]:
    if direction is Direction.LOWER_IS_BETTER:
        return {"green_hi": Decimal(green), "amber_hi": Decimal(amber)}
    return {"green_lo": Decimal(green), "amber_lo": Decimal(amber)}


def _numbers(text: str) -> list[Decimal]:
    return [Decimal(part) for part in text.replace(" and ", ", ").split(", ")]


def _words(text: str) -> list[str]:
    return text.replace(" and ", ", ").split(", ")


def _date(text: str) -> datetime.date:
    return datetime.date.fromisoformat(text)


@given(
    parsers.re(
        rf"a (?P<direction>higher_is_better) metric with green from (?P<green>{NUMBER}) "
        rf"and amber from (?P<amber>{NUMBER})"
    ),
    target_fixture="board",
)
@given(
    parsers.re(
        rf"a (?P<direction>lower_is_better) metric with green up to (?P<green>{NUMBER}) "
        rf"and amber up to (?P<amber>{NUMBER})"
    ),
    target_fixture="board",
)
def one_sided_metric(direction: str, green: str, amber: str) -> Board:
    board = Board(Direction(direction))
    board.add(datetime.date(2000, 1, 1), **_one_sided(board.direction, green, amber))
    return board


@given(
    parsers.re(
        rf"a within_band metric with green from (?P<green_lo>{NUMBER}) to (?P<green_hi>{NUMBER}) "
        rf"and amber from (?P<amber_lo>{NUMBER}) to (?P<amber_hi>{NUMBER})"
    ),
    target_fixture="board",
)
def band_metric(green_lo: str, green_hi: str, amber_lo: str, amber_hi: str) -> Board:
    board = Board(Direction.WITHIN_BAND)
    board.add(
        datetime.date(2000, 1, 1),
        green_lo=Decimal(green_lo),
        green_hi=Decimal(green_hi),
        amber_lo=Decimal(amber_lo),
        amber_hi=Decimal(amber_hi),
    )
    return board


@given(
    parsers.re(
        rf"a higher_is_better metric with a version effective from (?P<effective>{DATE}), "
        rf"green from (?P<green>{NUMBER}) and amber from (?P<amber>{NUMBER})"
    ),
    target_fixture="board",
)
def dated_metric(effective: str, green: str, amber: str) -> Board:
    board = Board(Direction.HIGHER_IS_BETTER)
    board.add(_date(effective), **_one_sided(board.direction, green, amber))
    return board


@given(
    parsers.re(
        rf'a metric with versions "(?P<first>[^"]+)" effective from (?P<first_date>{DATE}) '
        rf'and "(?P<second>[^"]+)" effective from (?P<second_date>{DATE})'
    ),
    target_fixture="board",
)
def two_dated_versions(first: str, first_date: str, second: str, second_date: str) -> Board:
    board = Board()
    board.add(_date(first_date), green_lo=Decimal(1), amber_lo=Decimal(0), name=first)
    board.add(_date(second_date), green_lo=Decimal(1), amber_lo=Decimal(0), name=second)
    return board


@given(
    parsers.re(
        r'a metric with versions "(?P<first>[^"]+)" and "(?P<second>[^"]+)" both effective '
        rf"from (?P<effective>{DATE}), recorded in that order"
    ),
    target_fixture="board",
)
def two_versions_on_one_date(first: str, second: str, effective: str) -> Board:
    board = Board()
    for name in (first, second):
        board.add(_date(effective), green_lo=Decimal(1), amber_lo=Decimal(0), name=name)
    return board


@given(
    parsers.re(rf'a metric with versions "(?P<name>[^"]+)" effective from (?P<effective>{DATE})'),
    target_fixture="board",
)
def one_dated_version(name: str, effective: str) -> Board:
    board = Board()
    board.add(_date(effective), green_lo=Decimal(1), amber_lo=Decimal(0), name=name)
    return board


@when(parsers.re(r"the values (?P<values>.+) are judged"))
def judge_values(board: Board, values: str) -> None:
    board.judged = [board.judge(value) for value in _numbers(values)]


@when("a meeting has no number and no colour set by hand")
def nothing_recorded(board: Board) -> None:
    board.value, board.manual = None, None


@given(parsers.re(rf"the value (?P<value>{NUMBER}) is recorded at a meeting on (?P<day>{DATE})"))
@when(parsers.re(rf"the value (?P<value>{NUMBER}) is recorded at a meeting on (?P<day>{DATE})"))
def value_at_meeting(board: Board, value: str, day: str) -> None:
    board.value, board.meeting_date = Decimal(value), _date(day)


@when(
    parsers.re(
        rf"the value (?P<value>{NUMBER}) is judged with the colour (?P<colour>green|amber|red) "
        r"set by hand"
    )
)
def value_with_manual_colour(board: Board, value: str, colour: str) -> None:
    board.value, board.manual = Decimal(value), Colour(colour)


@when(
    parsers.re(
        rf"a version effective from (?P<effective>{DATE}), green from (?P<green>{NUMBER}) "
        rf"and amber from (?P<amber>{NUMBER}), is added"
    )
)
def back_dated_version(board: Board, effective: str, green: str, amber: str) -> None:
    board.add(_date(effective), **_one_sided(board.direction, green, amber))


@then(parsers.re(r"they are (?P<statuses>.+)"))
def statuses_are(board: Board, statuses: str) -> None:
    assert board.judged == [Status(word) for word in _words(statuses)]


@given(parsers.re(r"its status is (?P<status>\w+)"))
@then(parsers.re(r"its status is (?P<status>\w+)"))
def status_is(board: Board, status: str) -> None:
    assert board.judge(board.value, board.manual) is Status(status)


@then("it is marked as set by hand")
def set_by_hand(board: Board) -> None:
    # What the read model reports as `set_by_hand`, and what the rule let win.
    assert board.manual is not None
    assert board.judge(board.value, None) is not Status(board.manual.value)


@then(parsers.re(rf'the version in force on (?P<day>{DATE}) is "(?P<name>[^"]+)"'))
def version_in_force(board: Board, day: str, name: str) -> None:
    version = threshold_in_force(board.versions, _date(day))
    assert version is not None
    assert version.name == name


@then(parsers.re(rf"no version is in force on (?P<day>{DATE})"))
def no_version_in_force(board: Board, day: str) -> None:
    assert threshold_in_force(board.versions, _date(day)) is None
