"""Who may obtain a local token in development mode, and with what password.

Until a person chooses a password, their development password is derived from
the email by a rule anyone can read here, and it does no more than let them
choose one: the first sign-in with it issues no token. The chosen password is
kept only as a salted scrypt hash in `dev_credentials`, keyed by email, so it
exists for an administrator with no employee record too. Deleting that row is
the reset: the derived password applies again.

No HTTP; the caller provides the session. A password change commits it.
"""

import base64
import hashlib
import hmac
import logging
import secrets
from collections.abc import Set
from dataclasses import dataclass
from itertools import groupby

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    DevPasswordTooShortError,
    DevPasswordUnchangedError,
    EmployeeNameTooLongError,
    IncorrectDevPasswordError,
    UnknownEmployeeError,
)
from app.models import PERSON_NAME_MAX_LENGTH, DevCredential, Employee
from app.services import names

logger = logging.getLogger(__name__)

#: The shortest password a person may choose.
DEV_PASSWORD_MIN_LENGTH = 8

#: scrypt cost: memory-hard and slow enough for test accounts, fast enough
#: that a sign-in does not drag. Stored with each hash, so raising it later
#: needs no schema change and leaves existing hashes verifiable.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_BYTES = 32
#: 128 * n * r is 16 MiB at these costs; OpenSSL needs a little more than that.
_SCRYPT_MAXMEM = 64 * 1024 * 1024


def dev_password(email: str) -> str:
    """The first two characters of each run of letters and digits, in order.

    `grzegorz.galka@pse.pl` gives `grgapspl`; a one-character run gives its one
    character. Expects the email already normalised (trimmed, lower-cased), as
    the request schema leaves it.
    """
    return "".join("".join(run)[:2] for is_alnum, run in groupby(email, str.isalnum) if is_alnum)


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        maxmem=_SCRYPT_MAXMEM,
        dklen=_KEY_BYTES,
    )


def hash_password(password: str) -> str:
    """A salted scrypt hash, as `scrypt$<n>$<r>$<p>$<salt b64>$<hash b64>`."""
    salt = secrets.token_bytes(_SALT_BYTES)
    key = _scrypt(password, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(key)}"


def verify_password(password: str, stored: str) -> bool:
    """Whether the password hashes to the stored value; a malformed one never matches."""
    try:
        scheme, n, r, p, salt, key = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(key, validate=True)
        actual = _scrypt(password, base64.b64decode(salt, validate=True), int(n), int(r), int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


@dataclass(frozen=True, slots=True)
class DevLoginResult:
    """What a correct development sign-in leads to.

    Either a token may be issued for `email`, or - after the derived
    password - a new password must be chosen first, with the name and
    surname proposed for the window. Both are None for an administrator with
    no employee record, which is also what tells the window to ask for none.
    """

    email: str
    password_change_required: bool
    name: str | None = None
    surname: str | None = None


def _is_current_password(session: Session, email: str, password: str) -> bool:
    """Whether the password is the email's current one: the chosen, else the derived."""
    credential = session.get(DevCredential, email)
    if credential is not None:
        return verify_password(password, credential.password_hash)
    return hmac.compare_digest(password.encode("utf-8"), dev_password(email).encode("utf-8"))


def _known_person(
    session: Session, email: str, admin_emails: Set[str], action: str
) -> Employee | None:
    """The employee for the email, None for an administrator with no record, or raise."""
    employee = session.scalars(select(Employee).where(Employee.email == email)).one_or_none()
    if employee is None and email not in admin_emails:
        logger.info("Development %s refused for %s: employee unknown", action, email)
        raise UnknownEmployeeError(email)
    return employee


def _proposed_names(employee: Employee | None, email: str) -> tuple[str | None, str | None]:
    """The name and surname the first-login window starts from.

    The stored ones if either is set, else the parts derived from the email.
    A missing part of a recorded employee is an empty string rather than None,
    so that only "no record" hides the fields.
    """
    if employee is None:
        return (None, None)
    stored = (_trimmed(employee.name), _trimmed(employee.surname))
    if any(stored):
        return (stored[0] or "", stored[1] or "")
    name, surname = names.name_parts_from_email(email)
    return (name, surname or "")


def authenticate_dev_login(
    session: Session, email: str, password: str, admin_emails: Set[str]
) -> DevLoginResult:
    """Return what a sign-in with this email and password leads to, or raise why not.

    The password is checked first, then who the email belongs to. The derived
    password issues no token: it only lets the person choose one. An
    administrator needs no employee record: on an empty database nobody else
    exists to register the first team. Never records an employee.

    Logs the email and the outcome, never the password.
    """
    if not _is_current_password(session, email, password):
        logger.info("Development sign-in refused for %s: password incorrect", email)
        raise IncorrectDevPasswordError()
    employee = _known_person(session, email, admin_emails, "sign-in")
    if session.get(DevCredential, email) is None:
        logger.info("Development sign-in by %s needs a new password", email)
        name, surname = _proposed_names(employee, email)
        return DevLoginResult(email, password_change_required=True, name=name, surname=surname)
    logger.info("Development sign-in by %s", email)
    return DevLoginResult(email, password_change_required=False)


def _trimmed(value: str | None) -> str | None:
    """A name as stored: trimmed, with a blank one as None."""
    if value is None:
        return None
    return value.strip() or None


def _checked_name(value: str | None, field: str) -> str | None:
    name = _trimmed(value)
    if name is not None and len(name) > PERSON_NAME_MAX_LENGTH:
        raise EmployeeNameTooLongError(field, PERSON_NAME_MAX_LENGTH)
    return name


def set_dev_password(
    session: Session,
    email: str,
    current_password: str,
    new_password: str,
    name: str | None,
    surname: str | None,
    admin_emails: Set[str],
) -> str:
    """Store a chosen password and the person's name, and return the email signed in.

    Checks, in order: the current password, who the email belongs to, then
    the new password and the names. Nothing is written unless all pass, and
    everything is written in one commit. The name and surname are stored only
    on a recorded employee; an administrator with no record gets a password
    and no record.

    Logs the email and the outcome, never a password or a name.
    """
    if not _is_current_password(session, email, current_password):
        logger.info("Development password change refused for %s: password incorrect", email)
        raise IncorrectDevPasswordError()
    employee = _known_person(session, email, admin_emails, "password change")
    if len(new_password) < DEV_PASSWORD_MIN_LENGTH:
        logger.info("Development password change refused for %s: too short", email)
        raise DevPasswordTooShortError(DEV_PASSWORD_MIN_LENGTH)
    if new_password == dev_password(email):
        logger.info("Development password change refused for %s: unchanged", email)
        raise DevPasswordUnchangedError()
    try:
        stored_name = _checked_name(name, "name")
        stored_surname = _checked_name(surname, "surname")
    except EmployeeNameTooLongError:
        logger.info("Development password change refused for %s: name too long", email)
        raise

    password_hash = hash_password(new_password)
    credential = session.get(DevCredential, email)
    if credential is None:
        session.add(DevCredential(email=email, password_hash=password_hash))
    else:
        credential.password_hash = password_hash
        credential.changed_at = func.now()
    if employee is not None:
        employee.name = stored_name
        employee.surname = stored_surname
    try:
        session.commit()
    except IntegrityError:
        # Another first choice for this email committed in the meantime, so the
        # derived password this request was checked against is no longer current.
        session.rollback()
        logger.info("Development password change refused for %s: password incorrect", email)
        raise IncorrectDevPasswordError() from None
    logger.info("Development password set for %s", email)
    return email
