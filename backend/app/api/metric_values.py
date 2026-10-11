"""A meeting's board, and recording a metric's value at it. Validate, delegate, return."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.schemas import MeetingBoard, MetricValueRead, MetricValueWrite
from app.services import today
from app.services.authz import may_record_meeting_data
from app.services.metric_values import Actor, build_board, record_value

router = APIRouter(prefix="/teams/{team_id}/meetings/{meeting_id}", tags=["metric values"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("/board", response_model=MeetingBoard)
def get_board(
    team_id: uuid.UUID, meeting_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> MeetingBoard:
    """Return the board at this meeting: every active metric, and whether it can be edited."""
    return build_board(session, team_id, meeting_id, today())


@router.put("/values/{metric_id}", response_model=MetricValueRead)
def put_value(
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    metric_id: uuid.UUID,
    payload: MetricValueWrite,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MetricValueRead:
    """Record what the metric shows at this meeting, replacing what was there.

    Any member of the team, or an administrator - and then only at a meeting
    still in the editing window, unless an administrator corrects with a reason.
    """
    require(
        may_record_meeting_data(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )
    actor = Actor(current_user.email, current_user.is_admin)
    return record_value(session, team_id, meeting_id, metric_id, payload, actor, today())
