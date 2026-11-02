"""One test per scenario of "The boundaries a target value amounts to" in specs/metrics/spec.md."""

from dataclasses import dataclass
from decimal import Decimal, localcontext

from app.core.metric_enums import Direction, Status
from app.services.metric_status import ResolvedBounds, bounds_of, status_of


@dataclass
class Version:
    """A threshold version as `bounds_of` reads it."""

    target_value: Decimal | None = None
    green_pct: Decimal | None = None
    amber_pct: Decimal | None = None
    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


def _target(target: str, green: str, amber: str) -> Version:
    return Version(Decimal(target), Decimal(green), Decimal(amber))


def test_higher_is_better_falls_short_of_the_target_value() -> None:
    bounds = bounds_of(Direction.HIGHER_IS_BETTER, _target("100", "5", "10"))

    assert bounds == ResolvedBounds(green_lo=Decimal(95), amber_lo=Decimal(90))


def test_lower_is_better_goes_over_the_target_value() -> None:
    bounds = bounds_of(Direction.LOWER_IS_BETTER, _target("20", "10", "25"))

    assert bounds == ResolvedBounds(green_hi=Decimal(22), amber_hi=Decimal(25))


def test_a_negative_target_value() -> None:
    bounds = bounds_of(Direction.HIGHER_IS_BETTER, _target("-20", "50", "100"))

    assert bounds == ResolvedBounds(green_lo=Decimal(-30), amber_lo=Decimal(-40))


def test_a_tolerance_that_does_not_divide_evenly() -> None:
    bounds = bounds_of(Direction.HIGHER_IS_BETTER, _target("95", "0", "5.263158"))

    exact = Decimal(95) - Decimal(95) * Decimal("5.263158") / 100
    assert bounds.amber_lo == exact == Decimal("89.9999999")
    # Rounded to the 6 places a number is stored with, the boundary would be
    # 90.000000 and these values red; against the exact boundary they are not.
    judged = [
        status_of(Direction.HIGHER_IS_BETTER, Decimal(value), None, bounds)
        for value in ("89.99999995", "89.9999999", "89.99999989")
    ]
    assert judged == [Status.AMBER, Status.AMBER, Status.RED]


def test_a_band_takes_both_sides_of_the_target_value() -> None:
    bounds = bounds_of(Direction.WITHIN_BAND, _target("72.3", "5", "10"))

    assert bounds == ResolvedBounds(
        Decimal("68.685"), Decimal("75.915"), Decimal("65.07"), Decimal("79.53")
    )


def test_a_version_with_boundaries_is_read_as_it_is() -> None:
    for target in (None, Decimal(0)):
        version = Version(target, green_hi=Decimal(5), amber_hi=Decimal(10))

        assert bounds_of(Direction.LOWER_IS_BETTER, version) == ResolvedBounds(
            green_hi=Decimal(5), amber_hi=Decimal(10)
        )


def test_the_largest_numbers_stored_are_resolved_exactly() -> None:
    largest = "999999999999999.999999"
    bounds = bounds_of(Direction.LOWER_IS_BETTER, _target(largest, largest, largest))

    # 43 significant digits: more than the default 28-digit context keeps.
    with localcontext(prec=100):
        expected = Decimal(largest) + Decimal(largest) * Decimal(largest) / 100
    assert len(expected.as_tuple().digits) > 28
    assert bounds.green_hi == expected
