"""Team endpoints. Validate input, delegate, and return - nothing else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import (
    CurrentUserDependency,
    relationship_to,
    require,
    require_admin,
)
from app.core.db import get_session
from app.models import TeamMember
from app.schemas import LeaderChange, MemberAdd, ScheduleSet, TeamCreate, TeamDetail, TeamRead
from app.services import (
    add_member,
    appoint_deputy,
    change_leader,
    get_team,
    list_teams,
    register_team,
    remove_member,
    revoke_deputy,
    set_schedule,
)
from app.services.authz import (
    may_appoint_deputies,
    may_change_the_leader,
    may_configure_the_board,
    may_manage_membership,
)

router = APIRouter(prefix="/teams", tags=["teams"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate, session: SessionDependency, current_user: CurrentUserDependency
) -> TeamRead:
    """Register a team, the board it owns, and its leader as its first member.

    Administrators only: there is no leader before the team exists, so there is
    nobody else this could belong to.
    """
    require_admin(current_user)
    team = register_team(session, payload.name, payload.leader_email)
    return TeamRead.model_validate(team)


@router.get("", response_model=list[TeamRead])
def get_teams(session: SessionDependency, _: CurrentUserDependency) -> list[TeamRead]:
    """Return every registered team, ordered by name.

    Any valid token reads: the current user is required so that a signed-out
    caller is refused, and is not otherwise consulted.
    """
    return [TeamRead.model_validate(team) for team in list_teams(session)]


@router.get("/{team_id}", response_model=TeamDetail)
def read_team(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> TeamDetail:
    """Return one team with its members, ordered by email. Any valid token reads."""
    return TeamDetail.model_validate(get_team(session, team_id))


@router.post("/{team_id}/members", response_model=TeamDetail, status_code=status.HTTP_201_CREATED)
def create_member(
    team_id: uuid.UUID,
    payload: MemberAdd,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamDetail:
    """Add an employee to a team by email, recording the employee if new.

    The team's own leader or deputies, or an administrator: people joining a
    team is for whoever runs it to handle, so it needs nobody above them.
    """
    require(
        may_manage_membership(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )
    return TeamDetail.model_validate(add_member(session, team_id, payload.email))


@router.delete("/{team_id}/members/{employee_id}", response_model=TeamDetail)
def delete_member(
    team_id: uuid.UUID,
    employee_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamDetail:
    """Remove a member who is not the leader from a team.

    An ordinary member is removed by whoever runs the team; a deputy only by
    the leader or an administrator, or removing and re-adding would be a
    deputy's way round not choosing deputies. The one rule that needs a fact
    about the target, so it is read here and the rules stay pure.
    """
    relationship = relationship_to(session, current_user, team_id)
    target = session.get(TeamMember, (team_id, employee_id))
    if target is not None and target.is_deputy:
        require(may_appoint_deputies(is_admin=current_user.is_admin, relationship=relationship))
    else:
        require(may_manage_membership(is_admin=current_user.is_admin, relationship=relationship))
    return TeamDetail.model_validate(remove_member(session, team_id, employee_id))


@router.put("/{team_id}/leader", response_model=TeamDetail)
def replace_leader(
    team_id: uuid.UUID,
    payload: LeaderChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamDetail:
    """Make one of the team's members its leader.

    Administrators only, the current leader included: who runs a team is the
    organization's decision, so a leader does not choose their successor.
    """
    require(may_change_the_leader(is_admin=current_user.is_admin))
    return TeamDetail.model_validate(change_leader(session, team_id, payload.employee_id))


@router.put("/{team_id}/deputies/{employee_id}", response_model=TeamDetail)
def put_deputy(
    team_id: uuid.UUID,
    employee_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamDetail:
    """Make one of the team's members a leader deputy. Idempotent.

    The team's leader, or an administrator: the leader chooses who stands in
    for them, so a deputy does not appoint other deputies.
    """
    require(
        may_appoint_deputies(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )
    return TeamDetail.model_validate(appoint_deputy(session, team_id, employee_id))


@router.delete("/{team_id}/deputies/{employee_id}", response_model=TeamDetail)
def delete_deputy(
    team_id: uuid.UUID,
    employee_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamDetail:
    """Make a deputy an ordinary member again. Idempotent; they stay a member.

    The team's leader, or an administrator - a deputy does not revoke another
    deputy, nor themselves.
    """
    require(
        may_appoint_deputies(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )
    return TeamDetail.model_validate(revoke_deputy(session, team_id, employee_id))


@router.put("/{team_id}/schedule", response_model=TeamRead)
def replace_schedule(
    team_id: uuid.UUID,
    payload: ScheduleSet,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> TeamRead:
    """Set when the team meets each week, replacing any schedule it had.

    The team's leader or deputies, or an administrator: when a team meets is
    part of configuring its board.
    """
    require(
        may_configure_the_board(
            is_admin=current_user.is_admin,
            relationship=relationship_to(session, current_user, team_id),
        )
    )
    team = set_schedule(session, team_id, payload.weekday, payload.time, current_user.email)
    return TeamRead.model_validate(team)
