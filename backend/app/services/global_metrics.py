"""Business logic for the company-wide catalogue of global metrics.

A global metric is one definition shared by every board that includes it:
renaming it, retiring it or recording a threshold for it shows on all of
them. No HTTP, and no session lifecycle beyond the commit each write ends with.
"""

import datetime
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    DuplicateMetricNameError,
    MetricDirectionImmutableError,
    MetricHasValuesError,
    MetricNotFoundError,
)
from app.models import BoardMetric, Metric, MetricThreshold, MetricValue
from app.schemas.metric import GlobalMetricChange, GlobalMetricCreate, ThresholdCreate
from app.services.metric_status import threshold_in_force
from app.services.metrics import (
    lock_boards_and_check_name,
    new_threshold_version,
    versions_by_metric,
)

logger = logging.getLogger(__name__)

GLOBAL_METRIC_NAME_UNIQUE_INDEX = "uq_metrics_global_name_lower"


@dataclass(frozen=True, slots=True)
class GlobalMetricEntry:
    """A global metric, its threshold in force on the day asked about, and its reach."""

    metric: Metric
    threshold: MetricThreshold | None
    #: How many boards include it.
    boards: int


def add_global_metric(session: Session, payload: GlobalMetricCreate, actor_email: str) -> Metric:
    """Add a metric to the catalogue, with no threshold, not retired and on no board.

    Only other global metrics can clash with its name: no board includes it yet.
    """
    metric = Metric(
        team_id=None,
        name=payload.name,
        unit=payload.unit,
        decimals=payload.decimals,
        direction=payload.direction,
    )
    session.add(metric)
    _commit(session, payload.name)
    logger.info("Global metric %s added by %s", metric.id, actor_email)
    return metric


def list_global_metrics(session: Session, today: datetime.date) -> list[GlobalMetricEntry]:
    """Every global metric, retired ones included, by name ignoring case.

    Two statements however many there are: the metrics with their board
    counts, then every version of every one of them.
    """
    rows = session.execute(
        select(Metric, func.count(BoardMetric.team_id))
        .outerjoin(BoardMetric, BoardMetric.metric_id == Metric.id)
        .where(Metric.team_id.is_(None))
        .group_by(Metric.id)
        .order_by(func.lower(Metric.name))
    ).all()
    versions = versions_by_metric(session, [metric.id for metric, _ in rows])
    return [
        GlobalMetricEntry(metric, threshold_in_force(versions[metric.id], today), boards)
        for metric, boards in rows
    ]


def global_metric_entry(
    session: Session, metric: Metric, today: datetime.date
) -> GlobalMetricEntry:
    """One global metric as the catalogue lists it."""
    versions = versions_by_metric(session, [metric.id])[metric.id]
    boards = session.scalar(
        select(func.count()).select_from(BoardMetric).where(BoardMetric.metric_id == metric.id)
    )
    return GlobalMetricEntry(metric, threshold_in_force(versions, today), boards or 0)


def get_global_metric(session: Session, metric_id: uuid.UUID) -> Metric:
    """A global metric, or `MetricNotFoundError` - a board's own metric included."""
    metric = session.get(Metric, metric_id)
    if metric is None or metric.team_id is not None:
        raise MetricNotFoundError(metric_id)
    return metric


def change_global_metric(
    session: Session, metric_id: uuid.UUID, payload: GlobalMetricChange, actor_email: str
) -> Metric:
    """Change a global metric's definition, retire it or bring it back.

    Only the keys the request carried change. A new name must be free on
    every board that includes the metric, as well as in the catalogue.
    """
    metric = get_global_metric(session, metric_id)
    changes = payload.model_dump(exclude_unset=True)
    direction = changes.pop("direction", metric.direction)
    if direction != metric.direction:
        raise MetricDirectionImmutableError()
    if "name" in changes and changes["name"] != metric.name:
        including = session.scalars(
            select(BoardMetric.team_id).where(BoardMetric.metric_id == metric_id)
        )
        lock_boards_and_check_name(
            session, list(including), changes["name"], exclude_metric_id=metric_id
        )
    retired_before = metric.retired
    for key, value in changes.items():
        setattr(metric, key, value)
    _commit(session, metric.name)
    session.refresh(metric)
    logger.info("Global metric %s changed by %s", metric_id, actor_email)
    if metric.retired != retired_before:
        event = "retired" if metric.retired else "brought back"
        logger.info("Global metric %s %s by %s", metric_id, event, actor_email)
    return metric


def delete_global_metric(session: Session, metric_id: uuid.UUID, actor_email: str) -> None:
    """Delete a global metric no board ever recorded a value for.

    Its placements and threshold versions go with it.
    """
    metric = get_global_metric(session, metric_id)
    if session.scalar(select(exists().where(MetricValue.metric_id == metric_id))):
        raise MetricHasValuesError(metric_id)
    session.delete(metric)
    session.commit()
    logger.info("Global metric %s deleted by %s", metric_id, actor_email)


def record_global_threshold(
    session: Session, metric_id: uuid.UUID, payload: ThresholdCreate, actor_email: str
) -> MetricThreshold:
    """Add a threshold version to a global metric; it judges every including board."""
    metric = get_global_metric(session, metric_id)
    version = new_threshold_version(metric, payload, actor_email)
    session.add(version)
    session.commit()
    session.refresh(version)
    logger.info(
        "Threshold %s of global metric %s recorded by %s", version.id, metric_id, actor_email
    )
    return version


def list_global_thresholds(session: Session, metric_id: uuid.UUID) -> list[MetricThreshold]:
    """Every threshold version of a global metric, the most recent first."""
    get_global_metric(session, metric_id)
    return list(
        session.scalars(
            select(MetricThreshold)
            .where(MetricThreshold.metric_id == metric_id)
            .order_by(MetricThreshold.effective_from.desc(), MetricThreshold.recorded_at.desc())
        )
    )


def _commit(session: Session, name: str) -> None:
    """Commit, turning a clash on the global name index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if GLOBAL_METRIC_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateMetricNameError(name) from error
        raise
