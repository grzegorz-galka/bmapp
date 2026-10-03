"""What every guarded router asks for: a session, and who is calling.

The dependencies here do the I/O - read the header, verify the token, look the
employee up. The rules they enforce live in `app.services.authz` as pure
functions, so each rule is unit-tested without a request or a database.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.exceptions import ForbiddenError, NotAnEmployeeError
from app.core.security import AuthenticatedPerson, token_from_header, verify_token
from app.models import Employee, TeamMember
from app.services.authz import Relationship

SessionDependency = Annotated[Session, Depends(get_session)]


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The person a request is from.

    `employee` is None for someone who authenticated but has not been put on
    any team: employees are recorded on first assignment, not on first login.
    They may read everything and write nothing.
    """

    email: str
    is_admin: bool
    employee: Employee | None

    def require_employee(self) -> Employee:
        """The employee record, or the refusal a write needs it to raise."""
        if self.employee is None:
            raise NotAnEmployeeError(self.email)
        return self.employee


def get_authenticated_person(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedPerson:
    """Verify the bearer token and go no further.

    No session, so an endpoint that needs only the caller's email can answer
    without PostgreSQL - which is what keeps the hub replying while the
    database is down, as it did before it needed a token.
    """
    return verify_token(token_from_header(authorization), get_settings())


AuthenticatedPersonDependency = Annotated[AuthenticatedPerson, Depends(get_authenticated_person)]


def get_current_user(
    session: SessionDependency,
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Verify the bearer token and resolve it to an employee, if there is one.

    Never records an employee: signing in is not being put on a team.
    """
    settings: Settings = get_settings()
    person = verify_token(token_from_header(authorization), settings)
    employee = session.scalars(select(Employee).where(Employee.email == person.email)).one_or_none()
    return CurrentUser(
        email=person.email,
        is_admin=person.email in settings.admin_emails,
        employee=employee,
    )


CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]


def relationship_to(
    session: Session, current_user: CurrentUser, team_id: uuid.UUID
) -> Relationship:
    """What this person is to this team, read from the team's own records.

    A stranger when they are not a member, which is also the answer for
    someone with no employee record at all - there is no membership row to
    find, so no special case is needed for them.
    """
    if current_user.employee is None:
        return Relationship.STRANGER
    membership = session.get(TeamMember, (team_id, current_user.employee.id))
    if membership is None:
        return Relationship.STRANGER
    return Relationship.LEADER if membership.is_leader else Relationship.MEMBER


def require(permitted: bool) -> None:
    """Refuse unless the rule said yes.

    403 rather than 404: every authenticated person may read every team, so
    there is nothing to be gained by pretending it does not exist.
    """
    if not permitted:
        raise ForbiddenError()


def require_admin(current_user: CurrentUser) -> None:
    """The guard for the two actions that are the organization's to take."""
    require(current_user.is_admin)
