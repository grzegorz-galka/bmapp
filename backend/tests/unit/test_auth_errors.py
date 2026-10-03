"""The refusals authentication and authorization raise, and the codes they carry.

Asserted without HTTP: the status and the code belong to the exception, and the
one handler in `app.main` renders them. A code is published API, so a change
here is a change to what every client keys its wording on.
"""

import pytest

from app.core.exceptions import (
    DomainError,
    ExpiredTokenError,
    ForbiddenError,
    MissingTokenError,
    NotAnEmployeeError,
    UnauthenticatedError,
)


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (UnauthenticatedError(), 401, "auth.token_invalid"),
        (MissingTokenError(), 401, "auth.token_missing"),
        (ExpiredTokenError(), 401, "auth.token_expired"),
        (ForbiddenError(), 403, "auth.forbidden"),
        (NotAnEmployeeError("nobody@pse.pl"), 403, "auth.not_an_employee"),
    ],
)
def test_each_refusal_carries_its_status_and_code(
    error: DomainError, status_code: int, code: str
) -> None:
    assert (error.status_code, error.code) == (status_code, code)


@pytest.mark.parametrize(
    "error", [UnauthenticatedError(), MissingTokenError(), ExpiredTokenError()]
)
def test_an_unauthenticated_refusal_names_no_field(error: DomainError) -> None:
    """Nothing the caller submitted is at fault, so no field is blamed."""
    assert error.field is None


@pytest.mark.parametrize(
    "error", [UnauthenticatedError(), MissingTokenError(), ExpiredTokenError()]
)
def test_an_unauthenticated_refusal_does_not_say_what_was_expected(error: DomainError) -> None:
    """Naming the key, issuer or audience would tell an attacker what to forge."""
    message = error.message.lower()
    assert not any(word in message for word in ("issuer", "audience", "key", "rs256", "hs256"))


def test_every_auth_refusal_is_a_domain_error() -> None:
    """So the handler already registered in `app.main` renders them all."""
    for error in (MissingTokenError(), ExpiredTokenError(), NotAnEmployeeError("a@b.pl")):
        assert isinstance(error, DomainError)


def test_the_specific_token_refusals_are_unauthenticated_errors() -> None:
    for error in (MissingTokenError(), ExpiredTokenError()):
        assert isinstance(error, UnauthenticatedError)


def test_not_an_employee_is_a_forbidden_error() -> None:
    assert isinstance(NotAnEmployeeError("a@b.pl"), ForbiddenError)
