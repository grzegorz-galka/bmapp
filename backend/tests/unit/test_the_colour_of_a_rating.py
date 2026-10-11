"""Requirement: The colour of a rating.

The bands are fixed - green from 4, amber from 3, red below - and judged on the
exact average, not on the rounded one it prints as.
"""

from decimal import Decimal

from app.core.metric_enums import Status
from app.services.pulse_check import mood_status, summarise


def test_an_average_on_a_boundary() -> None:
    summary = summarise([5, 4, 3])

    assert summary.average == Decimal("4.00")
    assert mood_status(summary.average) is Status.GREEN


def test_an_average_just_below_a_boundary() -> None:
    summary = summarise([3, 3, 2])

    assert summary.average is not None
    assert round(summary.average, 2) == Decimal("2.67")
    assert mood_status(summary.average) is Status.RED


def test_individual_ratings_are_coloured() -> None:
    statuses = [mood_status(Decimal(rating)) for rating in (5, 3, 2)]

    assert statuses == [Status.GREEN, Status.AMBER, Status.RED]
