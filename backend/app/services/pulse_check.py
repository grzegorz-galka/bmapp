"""The results rule of the pulse check: the summary of a meeting's ratings and its colour.

Pure functions, no I/O and no SQLAlchemy, like `metric_status`. The average is
kept exact; it is rounded only when serialised, so the colour is decided on the
true value: 3.995 is amber even though it prints as 4.00.

The bands are constants here rather than a threshold row. Colours of metrics
come from their thresholds, and the pulse check is not a metric; the bands are
the same for every team.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from app.core.metric_enums import Status

#: The ratings an answer can carry, worst first.
RATINGS = (1, 2, 3, 4, 5)

#: An average or a rating at or above this is green; boundaries count as the better zone.
GREEN_FROM = Decimal(4)
#: An average or a rating at or above this, and below green, is amber.
AMBER_FROM = Decimal(3)


@dataclass(frozen=True, slots=True)
class Summary:
    """What a meeting's ratings add up to."""

    count: int
    #: The exact mean, or None when nobody answered.
    average: Decimal | None
    #: How many answers gave each rating, 1 to 5, every key present.
    distribution: dict[int, int]


def summarise(ratings: Iterable[int]) -> Summary:
    """Count, exact average and distribution of a meeting's ratings."""
    collected = list(ratings)
    distribution = {rating: 0 for rating in RATINGS}
    for rating in collected:
        distribution[rating] += 1
    average = Decimal(sum(collected)) / len(collected) if collected else None
    return Summary(count=len(collected), average=average, distribution=distribution)


def mood_status(average: Decimal | None) -> Status:
    """Green from 4, amber from 3, red below; no data when nobody answered.

    Serves an individual rating too: a rating is the average of one answer.
    """
    if average is None:
        return Status.NO_DATA
    if average >= GREEN_FROM:
        return Status.GREEN
    if average >= AMBER_FROM:
        return Status.AMBER
    return Status.RED
