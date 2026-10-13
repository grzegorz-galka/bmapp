"""A board's metric groups and its layout. Validate input, delegate, and return."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUserDependency
from app.api.metrics import _require_configurer
from app.core.db import get_session
from app.schemas import MetricGroupCreate, MetricGroupRead, MetricGroupRename, MetricLayout
from app.services.metrics import (
    add_group,
    arrange_layout,
    delete_group,
    list_groups,
    rename_group,
)

router = APIRouter(prefix="/teams/{team_id}", tags=["metrics"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("/metric-groups", response_model=list[MetricGroupRead])
def get_groups(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[MetricGroupRead]:
    """Return the board's groups in their order, empty ones included."""
    return [MetricGroupRead.model_validate(group) for group in list_groups(session, team_id)]


@router.post("/metric-groups", response_model=MetricGroupRead, status_code=status.HTTP_201_CREATED)
def create_group(
    team_id: uuid.UUID,
    payload: MetricGroupCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MetricGroupRead:
    """Add a group to the board, after its other groups."""
    _require_configurer(session, current_user, team_id)
    return MetricGroupRead.model_validate(add_group(session, team_id, payload, current_user.email))


@router.patch("/metric-groups/{group_id}", response_model=MetricGroupRead)
def update_group(
    team_id: uuid.UUID,
    group_id: uuid.UUID,
    payload: MetricGroupRename,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MetricGroupRead:
    """Rename a group of the board."""
    _require_configurer(session, current_user, team_id)
    group = rename_group(session, team_id, group_id, payload, current_user.email)
    return MetricGroupRead.model_validate(group)


@router.delete("/metric-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group(
    team_id: uuid.UUID,
    group_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a group; its metrics move, in order, after the ungrouped ones."""
    _require_configurer(session, current_user, team_id)
    delete_group(session, team_id, group_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/metric-layout", status_code=status.HTTP_204_NO_CONTENT)
def replace_layout(
    team_id: uuid.UUID,
    payload: MetricLayout,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Replace the board's layout as one, or refuse it whole as made against an older board."""
    _require_configurer(session, current_user, team_id)
    arrange_layout(session, team_id, payload, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
