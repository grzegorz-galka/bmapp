"""Metric definition, threshold and trend endpoints. Validate input, delegate, and return."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.schemas import (
    MetricChange,
    MetricCreate,
    MetricDefinitionRead,
    MetricRead,
    MetricTrend,
    ThresholdCreate,
    ThresholdRead,
)
from app.services import today
from app.services.authz import may_configure_the_board
from app.services.metric_values import build_trend
from app.services.metrics import (
    MetricWithThreshold,
    add_metric,
    change_metric,
    delete_metric,
    list_metrics,
    list_thresholds,
    record_threshold,
    with_threshold,
)

router = APIRouter(prefix="/teams/{team_id}/metrics", tags=["metrics"])

SessionDependency = Annotated[Session, Depends(get_session)]


def _require_configurer(session: Session, current_user: CurrentUser, team_id: uuid.UUID) -> None:
    """The team's leader or an administrator: what is measured is part of the board."""
    require(
        may_configure_the_board(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )


def _read(entry: MetricWithThreshold) -> MetricRead:
    return MetricRead(
        **dict(MetricDefinitionRead.model_validate(entry.metric)),
        threshold=ThresholdRead.model_validate(entry.threshold) if entry.threshold else None,
    )


@router.get("", response_model=list[MetricRead])
def get_metrics(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[MetricRead]:
    """Return the board's metrics, retired ones included, each with its threshold today."""
    return [_read(entry) for entry in list_metrics(session, team_id, today())]


@router.post("", response_model=MetricRead, status_code=status.HTTP_201_CREATED)
def create_metric(
    team_id: uuid.UUID,
    payload: MetricCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MetricRead:
    """Add a metric to the board."""
    _require_configurer(session, current_user, team_id)
    metric = add_metric(session, team_id, payload, current_user.email)
    return _read(MetricWithThreshold(metric, None))


@router.patch("/{metric_id}", response_model=MetricRead)
def update_metric(
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: MetricChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MetricRead:
    """Change a metric, retire it or bring it back. A key left out is left alone."""
    _require_configurer(session, current_user, team_id)
    metric = change_metric(session, team_id, metric_id, payload, current_user.email)
    return _read(with_threshold(session, metric, today()))


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_metric(
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a metric that has no recorded values."""
    _require_configurer(session, current_user, team_id)
    delete_metric(session, team_id, metric_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{metric_id}/thresholds", response_model=list[ThresholdRead])
def get_thresholds(
    team_id: uuid.UUID, metric_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[ThresholdRead]:
    """Return every threshold version of the metric, the most recent first."""
    return [ThresholdRead.model_validate(v) for v in list_thresholds(session, team_id, metric_id)]


@router.post(
    "/{metric_id}/thresholds", response_model=ThresholdRead, status_code=status.HTTP_201_CREATED
)
def create_threshold(
    team_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: ThresholdCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ThresholdRead:
    """Add a threshold version to the metric, effective from a date that may be past."""
    _require_configurer(session, current_user, team_id)
    version = record_threshold(session, team_id, metric_id, payload, current_user.email)
    return ThresholdRead.model_validate(version)


@router.get("/{metric_id}/trend", response_model=MetricTrend)
def get_trend(
    team_id: uuid.UUID, metric_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> MetricTrend:
    """Return the metric at every meeting of its team, with its correction log."""
    return build_trend(session, team_id, metric_id)
