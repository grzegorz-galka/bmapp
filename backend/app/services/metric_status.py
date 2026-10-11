"""The rule that turns a recorded value into a status.

Pure: no I/O, nothing from SQLAlchemy, `Decimal` throughout. The API, the
board and the trend all call it, so no two places can disagree on a colour,
and the BDD feature exercises it directly.
"""

import datetime
from collections.abc import Iterable
from decimal import Decimal
from typing import Protocol

from app.core.metric_enums import Colour, Direction, Status


class Bounds(Protocol):
    """The zone boundaries of a threshold version. Which are set depends on direction."""

    @property
    def green_lo(self) -> Decimal | None: ...
    @property
    def green_hi(self) -> Decimal | None: ...
    @property
    def amber_lo(self) -> Decimal | None: ...
    @property
    def amber_hi(self) -> Decimal | None: ...


class Version(Bounds, Protocol):
    """A threshold version: its bounds, from when it applies, and when it was recorded."""

    @property
    def effective_from(self) -> datetime.date: ...
    @property
    def recorded_at(self) -> datetime.datetime: ...


def threshold_in_force[V: Version](versions: Iterable[V], date: datetime.date) -> V | None:
    """The version a value at a meeting on `date` is judged against, or None.

    The latest effective date on or before the meeting's; of several on that
    date, the one recorded last - a correction made the same day wins.
    """
    applicable = [version for version in versions if version.effective_from <= date]
    if not applicable:
        return None
    return max(applicable, key=lambda version: (version.effective_from, version.recorded_at))


def status_of(
    direction: Direction,
    value: Decimal | None,
    manual_status: Colour | None,
    threshold: Bounds | None,
) -> Status:
    """The status of a value: a colour, no data, or no threshold.

    A colour set by hand wins even with no number, since it is how a member
    says what the number cannot. Boundaries count as the better zone: 95
    against "green from 95" is green.
    """
    if manual_status is not None:
        return Status(manual_status.value)
    if value is None:
        return Status.NO_DATA
    if threshold is None:
        return Status.NO_THRESHOLD
    if _within(value, *_green(direction, threshold)):
        return Status.GREEN
    if _within(value, *_amber(direction, threshold)):
        return Status.AMBER
    return Status.RED


def _green(direction: Direction, threshold: Bounds) -> tuple[Decimal | None, Decimal | None]:
    match direction:
        case Direction.HIGHER_IS_BETTER:
            return threshold.green_lo, None
        case Direction.LOWER_IS_BETTER:
            return None, threshold.green_hi
        case Direction.WITHIN_BAND:
            return threshold.green_lo, threshold.green_hi


def _amber(direction: Direction, threshold: Bounds) -> tuple[Decimal | None, Decimal | None]:
    match direction:
        case Direction.HIGHER_IS_BETTER:
            return threshold.amber_lo, None
        case Direction.LOWER_IS_BETTER:
            return None, threshold.amber_hi
        case Direction.WITHIN_BAND:
            return threshold.amber_lo, threshold.amber_hi


def _within(value: Decimal, low: Decimal | None, high: Decimal | None) -> bool:
    """Inside a closed interval, an absent end being unbounded."""
    return (low is None or value >= low) and (high is None or value <= high)
