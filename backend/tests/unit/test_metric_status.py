"""The status rule compares exact decimals, so a boundary is never missed by a rounding error."""

from dataclasses import dataclass
from decimal import Decimal

from app.core.metric_enums import Direction, Status
from app.services.metric_status import status_of


@dataclass
class Band:
    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


def test_71_point_0_against_a_boundary_of_71_is_green() -> None:
    band = Band(Decimal("71"), Decimal("72"), Decimal("70.5"), Decimal("72.5"))

    assert status_of(Direction.WITHIN_BAND, Decimal("71.0"), None, band) is Status.GREEN
    assert status_of(Direction.WITHIN_BAND, Decimal("71.000000"), None, band) is Status.GREEN


def test_a_value_that_floats_would_round_below_the_boundary_is_green() -> None:
    # 0.1 + 0.2 is 0.30000000000000004 in binary floating point; as decimals it is 0.3.
    threshold = Band(green_lo=Decimal("0.3"), amber_lo=Decimal("0.2"))

    value = Decimal("0.1") + Decimal("0.2")

    assert status_of(Direction.HIGHER_IS_BETTER, value, None, threshold) is Status.GREEN


def test_amber_equal_to_green_leaves_no_amber_zone() -> None:
    threshold = Band(green_hi=Decimal(5), amber_hi=Decimal(5))

    statuses = [
        status_of(Direction.LOWER_IS_BETTER, Decimal(v), None, threshold) for v in ("5", "5.01")
    ]

    assert statuses == [Status.GREEN, Status.RED]
