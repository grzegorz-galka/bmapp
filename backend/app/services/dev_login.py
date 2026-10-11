"""Who may obtain a local token in development mode, and with what password.

The password is derived from the email by a rule anyone can read here. It is a
typing check that keeps a developer deliberate about who they become, not a
secret: it protects nothing the mode toggle does not already protect.

No HTTP, and no session lifecycle: the caller provides the session.
"""

import logging
from collections.abc import Set

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import IncorrectDevPasswordError, UnknownEmployeeError
from app.models import Employee

logger = logging.getLogger(__name__)


def dev_password(email: str) -> str:
    """The first character, then the first after each run of non-alphanumerics.

    `grzegorz.galka@pse.pl` gives `ggpp`. Expects the email already normalised
    (trimmed, lower-cased), as the request schema leaves it.
    """
    password = email[:1]
    after_separator = False
    for character in email[1:]:
        if not character.isalnum():
            after_separator = True
        elif after_separator:
            password += character
            after_separator = False
    return password


def authenticate_dev_login(
    session: Session, email: str, password: str, admin_emails: Set[str]
) -> str:
    """Return the email a local token may be issued for, or raise why not.

    The password is checked first, so a wrong one costs no query. An
    administrator needs no employee record: on an empty database nobody else
    exists to register the first team. Never records an employee.

    Logs the email and the outcome, never the password.
    """
    if password != dev_password(email):
        logger.info("Development sign-in refused for %s: password incorrect", email)
        raise IncorrectDevPasswordError()
    if email not in admin_emails:
        employee = session.scalars(select(Employee.id).where(Employee.email == email)).one_or_none()
        if employee is None:
            logger.info("Development sign-in refused for %s: employee unknown", email)
            raise UnknownEmployeeError(email)
    logger.info("Development sign-in by %s", email)
    return email
