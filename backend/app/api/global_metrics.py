"""Global metric catalogue endpoints. Validate input, delegate, and return."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, CurrentUserDependency, require
from app.core.db import get_session
from app.schemas import (
    GlobalMetricChange,
    GlobalMetricCreate,
    GlobalMetricRead,
    ThresholdCreate,
    ThresholdRead,
)
from app.services import today
from app.services.authz import may_define_global_metrics
from app.services.global_metrics import (
    GlobalMetricEntry,
    add_global_metric,
    change_global_metric,
    delete_global_metric,
    global_metric_entry,
    list_global_metrics,
    list_global_thresholds,
    record_global_threshold,
)

router = APIRouter(prefix="/global-metrics", tags=["global-metrics"])

SessionDependency = Annotated[Session, Depends(get_session)]


def _require_definer(current_user: CurrentUser) -> None:
    """An administrator: a metric judged alike on every board is the organization's."""
    require(may_define_global_metrics(is_admin=current_user.is_admin))


def _read(entry: GlobalMetricEntry) -> GlobalMetricRead:
    metric = entry.metric
    return GlobalMetricRead(
        id=metric.id,
        name=metric.name,
        unit=metric.unit,
        decimals=metric.decimals,
        direction=metric.direction,
        retired=metric.retired,
        threshold=ThresholdRead.model_validate(entry.threshold) if entry.threshold else None,
        boards=entry.boards,
    )


@router.get("", response_model=list[GlobalMetricRead])
def get_global_metrics(
    session: SessionDependency, _: CurrentUserDependency
) -> list[GlobalMetricRead]:
    """Return the catalogue by name, retired metrics included, each with its threshold today."""
    return [_read(entry) for entry in list_global_metrics(session, today())]


@router.post("", response_model=GlobalMetricRead, status_code=status.HTTP_201_CREATED)
def create_global_metric(
    payload: GlobalMetricCreate, session: SessionDependency, current_user: CurrentUserDependency
) -> GlobalMetricRead:
    """Add a metric to the catalogue."""
    _require_definer(current_user)
    metric = add_global_metric(session, payload, current_user.email)
    return _read(GlobalMetricEntry(metric, None, 0))


@router.patch("/{metric_id}", response_model=GlobalMetricRead)
def update_global_metric(
    metric_id: uuid.UUID,
    payload: GlobalMetricChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> GlobalMetricRead:
    """Change a global metric, retire it or bring it back. A key left out is left alone."""
    _require_definer(current_user)
    metric = change_global_metric(session, metric_id, payload, current_user.email)
    return _read(global_metric_entry(session, metric, today()))


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_global_metric(
    metric_id: uuid.UUID, session: SessionDependency, current_user: CurrentUserDependency
) -> Response:
    """Delete a global metric no board has recorded a value for."""
    _require_definer(current_user)
    delete_global_metric(session, metric_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{metric_id}/thresholds", response_model=list[ThresholdRead])
def get_global_thresholds(
    metric_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[ThresholdRead]:
    """Return every threshold version of the global metric, the most recent first."""
    return [ThresholdRead.model_validate(v) for v in list_global_thresholds(session, metric_id)]


@router.post(
    "/{metric_id}/thresholds", response_model=ThresholdRead, status_code=status.HTTP_201_CREATED
)
def create_global_threshold(
    metric_id: uuid.UUID,
    payload: ThresholdCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ThresholdRead:
    """Add a threshold version to the global metric, effective from a date that may be past."""
    _require_definer(current_user)
    version = record_global_threshold(session, metric_id, payload, current_user.email)
    return ThresholdRead.model_validate(version)
