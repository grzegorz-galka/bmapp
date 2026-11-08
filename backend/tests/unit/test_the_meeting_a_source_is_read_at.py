"""One test per scenario of "The meeting a source is read at", and the computation. No I/O.

In specs/derived-metrics/spec.md, against the pure rules in `app/services/derivations.py`.
"""

import datetime
import uuid
from dataclasses import dataclass, field
from decimal import Decimal

import pytest

from app.core.metric_enums import DerivationKind
from app.services.derivations import derive, meeting_read_at, previous_meeting


@dataclass(frozen=True)
class _Meeting:
    date: datetime.date
    id: uuid.UUID = field(default_factory=uuid.uuid4)


def _on(*dates: str) -> list[_Meeting]:
    return [_Meeting(datetime.date.fromisoformat(date)) for date in dates]


def test_another_team_met_earlier_in_the_week() -> None:
    """Scenario: Another team met earlier in the week."""
    zarzad = _Meeting(datetime.date(2026, 10, 14))  # Wednesday
    cki_p = _on("2026-10-06", "2026-10-13", "2026-10-20")

    assert meeting_read_at(zarzad, False, cki_p) == cki_p[1]


def test_another_team_met_later_in_the_week() -> None:
    """Scenario: Another team met later in the week."""
    monday = _Meeting(datetime.date(2026, 10, 12))
    thursdays = _on("2026-10-08", "2026-10-15")

    assert meeting_read_at(monday, False, thursdays) == thursdays[1]


def test_another_team_met_twice_that_week() -> None:
    """Scenario: Another team met twice that week."""
    wednesday = _Meeting(datetime.date(2026, 10, 14))
    monday_and_thursday = _on("2026-10-15", "2026-10-12")

    assert meeting_read_at(wednesday, False, monday_and_thursday) == monday_and_thursday[0]


def test_a_source_on_the_same_team() -> None:
    """Scenario: A source on the same team."""
    recorded = _Meeting(datetime.date(2026, 10, 14))
    # Even beside another meeting of that team later the same week.
    team = [recorded, *_on("2026-10-16")]

    assert meeting_read_at(recorded, True, team) is recorded


def test_the_previous_meeting_for_a_delta() -> None:
    """Scenario: The previous meeting for a delta."""
    team = _on("2026-09-22", "2026-09-29", "2026-10-13")

    assert previous_meeting(team[2], team) == team[1]


def test_no_meeting_that_week() -> None:
    wednesday = _Meeting(datetime.date(2026, 10, 14))

    assert meeting_read_at(wednesday, False, _on("2026-10-11", "2026-10-19")) is None


def test_the_iso_week_crosses_a_new_year() -> None:
    # Monday 2026-12-28 and Sunday 2027-01-03 are in ISO week 53 of 2026.
    monday = _Meeting(datetime.date(2026, 12, 28))

    assert meeting_read_at(monday, False, _on("2027-01-03")) is not None
    assert meeting_read_at(monday, False, _on("2027-01-04")) is None


def test_no_previous_meeting() -> None:
    [first] = _on("2026-10-13")

    assert previous_meeting(first, [first]) is None


@pytest.mark.parametrize(
    ("kind", "numbers", "previous", "expected"),
    [
        (DerivationKind.MEAN, ["90", "97", "87", "83", "105", "101"], None, "93.833333"),
        (DerivationKind.MEAN, ["95"], None, "95"),
        # Half to even at the sixth place: 0.0000005 rounds down, 0.0000015 up.
        (DerivationKind.MEAN, ["0.000001", "0"], None, "0.000000"),
        (DerivationKind.MEAN, ["0.000003", "0"], None, "0.000002"),
        (DerivationKind.SUM, ["12.5", "7"], None, "19.5"),
        (DerivationKind.SUM, ["0.000001", "0.000002"], None, "0.000003"),
        (DerivationKind.DELTA, ["391"], "395", "-4"),
    ],
)
def test_each_kind_computes_its_number(
    kind: DerivationKind, numbers: list[str], previous: str | None, expected: str
) -> None:
    result = derive(
        kind, [Decimal(n) for n in numbers], Decimal(previous) if previous is not None else None
    )

    assert result == Decimal(expected)


@pytest.mark.parametrize(
    ("weights", "numbers", "expected"),
    [
        (["3", "1", "1"], ["90", "97", "87"], "90.8"),
        # 50/3: kept to 6 places.
        (["1", "2"], ["10", "20"], "16.666667"),
        # The weights need not add up to 1: these give the same as 3/1/1.
        (["0.6", "0.2", "0.2"], ["90", "97", "87"], "90.8"),
        # Half to even at the sixth place, as a mean: 0.0000005 down, 0.0000015 up.
        (["1", "1"], ["0.000001", "0"], "0.000000"),
        (["1", "1"], ["0.000003", "0"], "0.000002"),
        (["2.5"], ["95"], "95"),
    ],
)
def test_a_weighted_mean_computes_its_number(
    weights: list[str], numbers: list[str], expected: str
) -> None:
    result = derive(
        DerivationKind.WEIGHTED_MEAN,
        [Decimal(n) for n in numbers],
        None,
        [Decimal(w) for w in weights],
    )

    assert result == Decimal(expected)
