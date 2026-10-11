"""The pulse check of a meeting: its results and the caller's own answer. Validate, delegate."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUserDependency, relationship_to, require
from app.core.db import get_session
from app.schemas import PulseAnswerRead, PulseAnswerWrite, PulseResults
from app.services import today
from app.services.authz import may_answer_the_pulse_check, may_read_pulse_answers
from app.services.pulse_answers import Respondent, build_results, record_answer

router = APIRouter(prefix="/teams/{team_id}/meetings/{meeting_id}/pulse", tags=["pulse check"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("", response_model=PulseResults)
def get_results(
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> PulseResults:
    """Return the meeting's pulse check to anyone signed in.

    The individual answers and who has not answered only to the team and
    administrators; anyone else gets the same results without them, not a
    refusal.
    """
    may_read_names = may_read_pulse_answers(
        is_admin=current_user.is_admin,
        relationship=relationship_to(session, current_user, team_id),
    )
    viewer_id = current_user.employee.id if current_user.employee else None
    return build_results(session, team_id, meeting_id, viewer_id, may_read_names, today())


@router.put("/me", response_model=PulseAnswerRead)
def put_own_answer(
    team_id: uuid.UUID,
    meeting_id: uuid.UUID,
    payload: PulseAnswerWrite,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> PulseAnswerRead:
    """Record the caller's own answer, replacing their earlier one.

    Only a member of the team, an administrator included only if they are
    one; checked before the answering window, so a stranger hears
    `auth.forbidden` rather than that the meeting is frozen.
    """
    require(
        may_answer_the_pulse_check(relationship=relationship_to(session, current_user, team_id))
    )
    employee = current_user.require_employee()
    respondent = Respondent(employee.id, current_user.email)
    return record_answer(session, team_id, meeting_id, respondent, payload, today())
