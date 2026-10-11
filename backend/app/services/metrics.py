"""Business logic for a board's metric definitions and their threshold versions.

No HTTP, and no session lifecycle beyond the commit each write ends with.
"""

import datetime
import logging
import uuid
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    DuplicateMetricNameError,
    MetricDirectionImmutableError,
    MetricHasValuesError,
    MetricNotFoundError,
    MetricOwnerNotMemberError,
    TeamNotFoundError,
)
from app.models import Metric, MetricThreshold, MetricValue, Team, TeamMember
from app.schemas.metric import MetricChange, MetricCreate, ThresholdCreate
from app.services.metric_status import threshold_in_force

logger = logging.getLogger(__name__)

METRIC_NAME_UNIQUE_INDEX = "uq_metrics_team_name_lower"


@dataclass(frozen=True, slots=True)
class MetricWithThreshold:
    """A metric and the threshold version in force on the day asked about."""

    metric: Metric
    threshold: MetricThreshold | None


def add_metric(
    session: Session, team_id: uuid.UUID, payload: MetricCreate, actor_email: str
) -> Metric:
    """Add a metric to a team's board, with no threshold yet and not retired."""
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    _require_member_owner(session, team_id, payload.owner_employee_id)
    metric = Metric(team_id=team_id, **payload.model_dump())
    session.add(metric)
    _commit(session, payload.name)
    logger.info("Metric %s of team %s added by %s", metric.id, team_id, actor_email)
    return metric


def list_metrics(
    session: Session, team_id: uuid.UUID, today: datetime.date
) -> list[MetricWithThreshold]:
    """A board's metrics, retired ones included, by position and then name.

    Each with its threshold in force today. Two statements however many
    metrics there are: the metrics, then every version of every one of them.
    """
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)
    metrics = list(
        session.scalars(
            select(Metric)
            .where(Metric.team_id == team_id)
            .order_by(Metric.position, func.lower(Metric.name))
        )
    )
    versions = versions_by_metric(session, [metric.id for metric in metrics])
    return [
        MetricWithThreshold(metric, threshold_in_force(versions[metric.id], today))
        for metric in metrics
    ]


def with_threshold(session: Session, metric: Metric, today: datetime.date) -> MetricWithThreshold:
    """A metric with its threshold in force today."""
    versions = versions_by_metric(session, [metric.id])[metric.id]
    return MetricWithThreshold(metric, threshold_in_force(versions, today))


def change_metric(
    session: Session,
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: MetricChange,
    actor_email: str,
) -> Metric:
    """Change a metric's properties, retire it or bring it back.

    Only the keys the request carried change. The direction may be repeated
    but not changed: every threshold version is read through it.
    """
    metric = get_metric(session, team_id, metric_id)
    changes = payload.model_dump(exclude_unset=True)
    direction = changes.pop("direction", metric.direction)
    if direction != metric.direction:
        raise MetricDirectionImmutableError()
    if changes.get("owner_employee_id") is not None:
        _require_member_owner(session, team_id, changes["owner_employee_id"])
    retired_before = metric.retired
    for name, value in changes.items():
        setattr(metric, name, value)
    _commit(session, metric.name)
    session.refresh(metric)
    logger.info("Metric %s of team %s changed by %s", metric.id, team_id, actor_email)
    if metric.retired != retired_before:
        event = "retired" if metric.retired else "brought back"
        logger.info("Metric %s of team %s %s by %s", metric.id, team_id, event, actor_email)
    return metric


def delete_metric(
    session: Session, team_id: uuid.UUID, metric_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a metric no value was ever recorded for, with its threshold versions."""
    metric = get_metric(session, team_id, metric_id)
    if session.scalar(select(exists().where(MetricValue.metric_id == metric_id))):
        raise MetricHasValuesError(metric_id)
    session.delete(metric)
    session.commit()
    logger.info("Metric %s of team %s deleted by %s", metric_id, team_id, actor_email)


def record_threshold(
    session: Session,
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: ThresholdCreate,
    actor_email: str,
) -> MetricThreshold:
    """Add a threshold version to a metric. Back-dating is allowed and intended.

    Versions are never edited: what a past meeting was judged against stays
    on record, and a mistake is corrected by a newer version.
    """
    metric = get_metric(session, team_id, metric_id)
    bounds = payload.bounds(metric.direction)
    version = MetricThreshold(
        metric_id=metric_id,
        effective_from=payload.effective_from,
        green_lo=bounds.green_lo,
        green_hi=bounds.green_hi,
        amber_lo=bounds.amber_lo,
        amber_hi=bounds.amber_hi,
        reason=payload.reason,
        recorded_by_email=actor_email,
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    logger.info(
        "Threshold %s of metric %s of team %s recorded by %s",
        version.id,
        metric_id,
        team_id,
        actor_email,
    )
    return version


def list_thresholds(
    session: Session, team_id: uuid.UUID, metric_id: uuid.UUID
) -> list[MetricThreshold]:
    """Every threshold version of a metric, the most recent first."""
    get_metric(session, team_id, metric_id)
    return list(
        session.scalars(
            select(MetricThreshold)
            .where(MetricThreshold.metric_id == metric_id)
            .order_by(MetricThreshold.effective_from.desc(), MetricThreshold.recorded_at.desc())
        )
    )


def versions_by_metric(
    session: Session, metric_ids: Iterable[uuid.UUID]
) -> defaultdict[uuid.UUID, list[MetricThreshold]]:
    """Every threshold version of these metrics, in one statement, keyed by metric."""
    ids = list(metric_ids)
    grouped: defaultdict[uuid.UUID, list[MetricThreshold]] = defaultdict(list)
    if ids:
        for version in session.scalars(
            select(MetricThreshold).where(MetricThreshold.metric_id.in_(ids))
        ):
            grouped[version.metric_id].append(version)
    return grouped


def get_metric(session: Session, team_id: uuid.UUID, metric_id: uuid.UUID) -> Metric:
    """A metric of this team, or `MetricNotFoundError` - also for another team's."""
    metric = session.get(Metric, metric_id)
    if metric is None or metric.team_id != team_id:
        raise MetricNotFoundError(metric_id)
    return metric


def _require_member_owner(
    session: Session, team_id: uuid.UUID, employee_id: uuid.UUID | None
) -> None:
    if employee_id is not None and session.get(TeamMember, (team_id, employee_id)) is None:
        raise MetricOwnerNotMemberError(employee_id)


def _commit(session: Session, name: str) -> None:
    """Commit, turning a clash on the unique name index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if METRIC_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateMetricNameError(name) from error
        raise
