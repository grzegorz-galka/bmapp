"""Who the caller is, as `GET /auth/me` reports it, and keeping the broker's names.

The broker's name claims are written here, when a person reads who they are,
rather than on every request: that keeps every other endpoint - the dashboard
summary especially - read-only. No employee is ever created: signing in is not
being put on a team.

No HTTP; the caller provides the session. A change of name commits it.
"""

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import PERSON_NAME_MAX_LENGTH, Employee
from app.services import names

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Identity:
    """The caller's email, admin flag, stored name parts and display name."""

    email: str
    is_admin: bool
    name: str | None
    surname: str | None
    display_name: str
    initials: str


def _storable(claim: str | None) -> str | None:
    """A claim worth storing: present, non-blank (already trimmed), and storable.

    One too long for the column is left out rather than cut short: a
    truncated name would be stored as if it were the person's own.
    """
    if claim is None or len(claim) > PERSON_NAME_MAX_LENGTH:
        return None
    return claim


def keep_name_claims(
    session: Session, employee: Employee, given_name: str | None, family_name: str | None
) -> None:
    """Store each non-blank claim that differs from what is stored; leave the rest."""
    changed = False
    given = _storable(given_name)
    if given is not None and given != employee.name:
        employee.name = given
        changed = True
    family = _storable(family_name)
    if family is not None and family != employee.surname:
        employee.surname = family
        changed = True
    if changed:
        session.commit()
        logger.info("Name of %s updated from the broker's claims", employee.email)


def identify(
    session: Session,
    email: str,
    is_admin: bool,
    employee: Employee | None,
    given_name: str | None,
    family_name: str | None,
) -> Identity:
    """Report the caller, first keeping their name claims on their employee record.

    For someone with no record nothing is stored, and the display name comes
    from the claims if they carry any, else from the email.
    """
    if employee is None:
        shown = names.display_name(email, given_name, family_name)
        return Identity(email, is_admin, None, None, shown, names.initials(shown))
    keep_name_claims(session, employee, given_name, family_name)
    shown = names.display_name(email, employee.name, employee.surname)
    return Identity(email, is_admin, employee.name, employee.surname, shown, names.initials(shown))
