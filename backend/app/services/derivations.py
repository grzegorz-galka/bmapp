"""A board's own metric worked out from other metrics recorded in the same week.

Setting a derivation checks its sources against the boards they are named
on. Deriving a number picks the meeting each source is read at and computes
it; those two rules are pure functions here, testable without a database,
and the service that reads the numbers lives beside the board's other reads
in `metric_values`.
"""

import datetime
import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Protocol

from sqlalchemy import exists, select, tuple_
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from app.core.exceptions import (
    DerivationSourceCountError,
    DerivationSourceDuplicateError,
    DerivationSourceNotFoundError,
    DerivationSourceSelfError,
    MetricDerivationSourceError,
)
from app.core.metric_enums import DerivationKind
from app.models import BoardMetric, Metric, MetricDerivationSource
from app.schemas.metric import DerivationWrite

#: A mean is kept to the scale a number is stored at, rounding half to even.
MEAN_QUANTUM = Decimal("0.000001")


class Dated(Protocol):
    """A meeting as these rules need it: which one, and its date on the organization's clock."""

    @property
    def id(self) -> uuid.UUID: ...

    @property
    def date(self) -> datetime.date: ...


def meeting_read_at[M: Dated](
    recorded: M, same_team: bool, source_team_meetings: Iterable[M]
) -> M | None:
    """The meeting a source is read at, for a value recorded at `recorded`.

    A source on the same team is read at the meeting being recorded. One on
    another team is read at that team's latest meeting in the same ISO week:
    a team that meets later in the week counts, last week's meeting never
    does. Meeting dates are already on the organization's clock, so the week
    is taken from the date alone.
    """
    if same_team:
        return recorded
    week = recorded.date.isocalendar()[:2]
    in_week = [m for m in source_team_meetings if m.date.isocalendar()[:2] == week]
    return max(in_week, key=lambda m: m.date, default=None)


def previous_meeting[M: Dated](meeting: M, team_meetings: Iterable[M]) -> M | None:
    """The team's meeting immediately before `meeting`, however long before; never further."""
    earlier = [m for m in team_meetings if m.date < meeting.date]
    return max(earlier, key=lambda m: m.date, default=None)


def derive(kind: DerivationKind, numbers: Sequence[Decimal], previous: Decimal | None) -> Decimal:
    """The number a derivation of this kind gives from its sources' numbers.

    A mean is quantised to 6 places, half to even; a sum and a delta are
    exact. `previous` is a delta's earlier number and is ignored otherwise.
    """
    if kind is DerivationKind.DELTA:
        assert previous is not None and len(numbers) == 1  # the caller found both
        return numbers[0] - previous
    total = sum(numbers, Decimal(0))
    if kind is DerivationKind.SUM:
        return total
    return (total / len(numbers)).quantize(MEAN_QUANTUM, rounding=ROUND_HALF_EVEN)


def check_derivation(
    session: Session,
    team_id: uuid.UUID,
    metric_id: uuid.UUID | None,
    derivation: DerivationWrite,
) -> None:
    """Refuse a derivation with the wrong number of sources, or a source that cannot be.

    Each source is checked in order - on its board, not the metric itself,
    not given before - and the first that fails is reported against itself.
    `metric_id` is none for a metric not yet added, which cannot name itself.
    One statement however many sources there are.
    """
    sources = derivation.sources
    if len(sources) == 0 or (derivation.kind is DerivationKind.DELTA and len(sources) != 1):
        raise DerivationSourceCountError(derivation.kind, len(sources))
    pairs = [(source.team_id, source.metric_id) for source in sources]
    placed = set(
        session.execute(
            select(BoardMetric.team_id, BoardMetric.metric_id).where(
                tuple_(BoardMetric.team_id, BoardMetric.metric_id).in_(pairs)
            )
        ).tuples()
    )
    seen: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for index, pair in enumerate(pairs):
        if pair not in placed:
            raise DerivationSourceNotFoundError(index, *pair)
        if pair == (team_id, metric_id):
            raise DerivationSourceSelfError(index)
        if pair in seen:
            raise DerivationSourceDuplicateError(index)
        seen.add(pair)


def set_derivation(session: Session, metric: Metric, derivation: DerivationWrite | None) -> None:
    """Replace a metric's derivation with one already checked, or remove it.

    The old sources are deleted before the new ones go in, so reordering the
    same sources does not meet the uniqueness of a source on a metric.
    """
    if metric.derivation_sources:
        metric.derivation_sources.clear()
        session.flush()
    if derivation is None:
        metric.derivation_kind = None
        return
    metric.derivation_kind = derivation.kind
    metric.derivation_sources.extend(
        MetricDerivationSource(
            position=position, source_team_id=source.team_id, source_metric_id=source.metric_id
        )
        for position, source in enumerate(derivation.sources)
    )


def load_derivations(session: Session, metrics: Iterable[Metric]) -> None:
    """Load the sources of every derived metric among these, in one statement or none.

    A list of a board's metrics reads each one's derivation; loading them
    one metric at a time would cost a statement per derived metric.
    """
    derived = {metric.id: metric for metric in metrics if metric.derivation_kind is not None}
    if not derived:
        return
    grouped: defaultdict[uuid.UUID, list[MetricDerivationSource]] = defaultdict(list)
    for source in session.scalars(
        select(MetricDerivationSource)
        .where(MetricDerivationSource.metric_id.in_(derived))
        .order_by(MetricDerivationSource.metric_id, MetricDerivationSource.position)
    ):
        grouped[source.metric_id].append(source)
    for metric_id, metric in derived.items():
        set_committed_value(metric, "derivation_sources", grouped[metric_id])


def refuse_removing_a_source(
    session: Session, metric_id: uuid.UUID, team_id: uuid.UUID | None = None
) -> None:
    """Refuse when a derivation reads this metric - on this team's board, when one is named."""
    reads_it = exists().where(MetricDerivationSource.source_metric_id == metric_id)
    if team_id is not None:
        reads_it = reads_it.where(MetricDerivationSource.source_team_id == team_id)
    if session.scalar(select(reads_it)):
        raise MetricDerivationSourceError(metric_id)
