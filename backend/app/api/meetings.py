"""Meeting endpoints. Validate input, delegate, and return - nothing else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.schemas import (
    MeetingChange,
    MeetingList,
    MeetingOpen,
    MeetingRead,
    ProposedMeeting,
    ScheduleRead,
)
from app.services import change_meeting, delete_meeting, list_meetings, open_meeting, today
from app.services.authz import may_record_meeting_data

router = APIRouter(prefix="/teams/{team_id}/meetings", tags=["meetings"])

SessionDependency = Annotated[Session, Depends(get_session)]


def _require_team_member(session: Session, current_user: CurrentUser, team_id: uuid.UUID) -> None:
    """Any member of the team, its leader included, or an administrator.

    Holding the meeting is the team's shared work; it does not wait on the
    leader.
    """
    require(
        may_record_meeting_data(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )


@router.get("", response_model=MeetingList)
def get_meetings(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> MeetingList:
    """Return the team's meetings, earliest first, with its schedule and the proposed next one.

    Any valid token reads.
    """
    overview = list_meetings(session, team_id, today())
    return MeetingList(
        schedule=ScheduleRead.model_validate(overview.schedule) if overview.schedule else None,
        proposed=(
            ProposedMeeting(date=overview.proposed[0], time=overview.proposed[1])
            if overview.proposed
            else None
        ),
        meetings=[MeetingRead.model_validate(meeting) for meeting in overview.meetings],
    )


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
def create_meeting(
    team_id: uuid.UUID,
    payload: MeetingOpen,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MeetingRead:
    """Open a meeting of the team on a date at a start time."""
    _require_team_member(session, current_user, team_id)
    meeting = open_meeting(session, team_id, payload.date, payload.time, current_user.email)
    return MeetingRead.model_validate(meeting)


@router.patch("/{meeting_id}", response_model=MeetingRead)
def update_meeting(
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    payload: MeetingChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> MeetingRead:
    """Move a meeting, name or clear its host, or both.

    A key left out is left alone; `host_employee_id: null` clears the host.
    """
    _require_team_member(session, current_user, team_id)
    meeting = change_meeting(
        session,
        team_id,
        meeting_id,
        current_user.email,
        date=payload.date,
        time=payload.time,
        set_host="host_employee_id" in payload.model_fields_set,
        host_employee_id=payload.host_employee_id,
    )
    return MeetingRead.model_validate(meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_meeting(
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a meeting, freeing its date."""
    _require_team_member(session, current_user, team_id)
    delete_meeting(session, team_id, meeting_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
