"""The summary of a meeting's ratings: count, exact average and distribution. No I/O."""

from decimal import ROUND_HALF_UP, Decimal

from app.core.metric_enums import Status
from app.services.pulse_check import mood_status, summarise


def test_seven_ratings_are_summarised() -> None:
    summary = summarise([5, 4, 4, 4, 3, 3, 2])

    assert summary.count == 7
    assert summary.average == Decimal(25) / 7
    assert summary.average.quantize(Decimal("0.01"), ROUND_HALF_UP) == Decimal("3.57")
    assert summary.distribution == {1: 0, 2: 1, 3: 2, 4: 3, 5: 1}
    assert mood_status(summary.average) is Status.AMBER


def test_no_answers() -> None:
    summary = summarise([])

    assert summary.count == 0
    assert summary.average is None
    assert mood_status(summary.average) is Status.NO_DATA
    assert summary.distribution == {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}


def test_an_average_that_rounds_up_to_a_boundary_is_judged_on_its_exact_value() -> None:
    """3.995 prints as 4.00 but stays amber."""
    assert mood_status(Decimal("3.995")) is Status.AMBER
