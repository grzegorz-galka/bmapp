"""Business logic for teams, their members and their leader.

No HTTP, and no session lifecycle: the caller provides the session.
"""

import logging
import uuid

from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import (
    DuplicateMemberError,
    DuplicateTeamNameError,
    LeaderNotMemberError,
    LeaderRemovalError,
    MemberNotFoundError,
    TeamNotFoundError,
)
from app.models import BoardDefinition, Team, TeamMember
from app.services.employees import get_or_create_employee

logger = logging.getLogger(__name__)

TEAM_NAME_UNIQUE_INDEX = "ix_teams_name_lower"
TEAM_MEMBER_PRIMARY_KEY = "team_members_pkey"


def register_team(session: Session, name: str, leader_email: str) -> Team:
    """Register a team with the one board it owns and its leader as first member.

    The board and the leadership are created here rather than by later calls,
    so there is no window in which a team exists without either. Everything
    goes in one commit: a duplicate name rolls back the employee just recorded
    for the leader too.
    """
    team = Team(name=name)
    team.board = BoardDefinition(name=name)
    team.members.append(
        TeamMember(employee=get_or_create_employee(session, leader_email), is_leader=True)
    )
    session.add(team)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        # The unique index is what detects a duplicate; a read-then-write check
        # would let two concurrent registrations both pass.
        if TEAM_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateTeamNameError(name) from error
        raise
    logger.info("Team %s registered with leader %s", team.id, leader_email)
    return team


def list_teams(session: Session) -> list[Team]:
    """Return every registered team, ordered by name ascending.

    Ordered case-insensitively to match how names are compared for uniqueness,
    so "alpha" and "Alpha" cannot sort into different halves of the list.
    Members are loaded in one further statement for the whole list, so the
    leader and member count cost no query per team.
    """
    statement = select(Team).options(selectinload(Team.members)).order_by(func.lower(Team.name))
    return list(session.scalars(statement).unique())


def get_team(session: Session, team_id: uuid.UUID) -> Team:
    """Return one team with its members, or raise `TeamNotFoundError`."""
    team = session.get(Team, team_id, options=[selectinload(Team.members)])
    if team is None:
        raise TeamNotFoundError(team_id)
    return team


def add_member(session: Session, team_id: uuid.UUID, email: str) -> Team:
    """Add the employee with this email to a team as a member who does not lead it."""
    team = get_team(session, team_id)
    employee = get_or_create_employee(session, email)
    try:
        # A Core insert rather than appending to the loaded collection: an
        # appended duplicate would collide with the existing membership in the
        # identity map before the database got to reject it.
        session.execute(
            insert(TeamMember).values(team_id=team.id, employee_id=employee.id, is_leader=False)
        )
        session.commit()
    except IntegrityError as error:
        session.rollback()
        # Detected from the primary key, like a duplicate team name from its
        # index, so two concurrent additions cannot both pass a prior check.
        if TEAM_MEMBER_PRIMARY_KEY in str(error.orig):
            raise DuplicateMemberError(email) from error
        raise
    session.refresh(team, ["members"])
    logger.info("Member %s added to team %s", email, team.id)
    return team


def remove_member(session: Session, team_id: uuid.UUID, employee_id: uuid.UUID) -> Team:
    """Remove a member from a team. The employee record itself is kept.

    The leader cannot be removed: that would leave the team leaderless, so
    leadership has to be handed over first.
    """
    team = get_team(session, team_id)
    membership = _membership(team, employee_id)
    if membership is None:
        raise MemberNotFoundError(employee_id)
    if membership.is_leader:
        raise LeaderRemovalError()
    email = membership.email
    team.members.remove(membership)
    session.commit()
    logger.info("Member %s removed from team %s", email, team.id)
    return team


def change_leader(session: Session, team_id: uuid.UUID, employee_id: uuid.UUID) -> Team:
    """Make a member of a team its leader; the previous leader stays a member.

    The team row is locked first, so two concurrent handovers on one team run
    one after the other. Without it, both could read the same old leader, and
    the second commit would fail on the one-leader index instead of applying.
    """
    statement = (
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members))
        # OF teams: the board is joined in, and the lock is wanted on the team.
        .with_for_update(of=Team)
        # The members must be read after the lock is held, not taken from an
        # identity map filled before another handover committed.
        .execution_options(populate_existing=True)
    )
    team = session.scalars(statement).unique().one_or_none()
    if team is None:
        raise TeamNotFoundError(team_id)
    new_leader = _membership(team, employee_id)
    if new_leader is None:
        raise LeaderNotMemberError(employee_id)
    if new_leader.is_leader:
        # Already the leader: nothing changes, but the lock is released now.
        session.commit()
        return team
    for member in team.members:
        member.is_leader = False
    # The one-leader index is checked per statement: the old flag has to be
    # cleared in the database before the new one is set.
    session.flush()
    new_leader.is_leader = True
    session.commit()
    logger.info("Leadership of team %s handed over to %s", team.id, new_leader.email)
    return team


def _membership(team: Team, employee_id: uuid.UUID) -> TeamMember | None:
    return next((member for member in team.members if member.employee_id == employee_id), None)
