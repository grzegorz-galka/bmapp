"""The employee email rule, through both request models that carry an email. No I/O."""

import pytest
from pydantic import ValidationError

from app.models import EMAIL_MAX_LENGTH
from app.schemas import MemberAdd, TeamCreate, normalise_email


def _code(email: object) -> str:
    with pytest.raises(ValidationError) as caught:
        MemberAdd(email=email)  # type: ignore[arg-type]
    error = caught.value.errors()[0]
    assert error["loc"] == ("email",)
    return str(error["type"])


def _address_of_length(length: int) -> str:
    domain = "@example.com"
    return "a" * (length - len(domain)) + domain


def test_trims_and_lower_cases() -> None:
    assert normalise_email("  Jan.Kowalski@Example.COM ") == "jan.kowalski@example.com"


@pytest.mark.parametrize("email", ["", "   ", "\t\n"])
def test_rejects_a_blank_email(email: str) -> None:
    assert _code(email) == "employee_email.blank"


def test_accepts_an_email_at_exactly_the_limit() -> None:
    email = _address_of_length(EMAIL_MAX_LENGTH)
    assert len(email) == 254
    assert MemberAdd(email=email).email == email


def test_rejects_an_email_one_over_the_limit() -> None:
    email = _address_of_length(EMAIL_MAX_LENGTH + 1)
    assert len(email) == 255
    assert _code(email) == "employee_email.too_long"


def test_padding_does_not_count_towards_the_limit() -> None:
    email = _address_of_length(EMAIL_MAX_LENGTH)
    assert MemberAdd(email=f"  {email}  ").email == email


@pytest.mark.parametrize(
    "email",
    [
        "jan.kowalski",  # no @
        "a@b",  # no dot in the domain
        "@b.c",  # nothing before the @
        "a@@b.c",  # more than one @
        "a@b@c.d",  # more than one @, apart
        "a@.bc",  # the domain's dot is its first character
        "a@bc.",  # the domain's dot is its last character
        "a@",  # no domain at all
        "jan kowalski@example.com",  # whitespace inside
        "jan@exa\tmple.com",  # whitespace inside, not a space
    ],
)
def test_rejects_a_malformed_email(email: str) -> None:
    assert _code(email) == "employee_email.invalid"


@pytest.mark.parametrize("email", ["a@b.c", "jan.kowalski@pse.pl", "x+tag@sub.example.com"])
def test_accepts_a_well_formed_email(email: str) -> None:
    assert MemberAdd(email=email).email == email


def test_a_non_text_email_fails_before_the_rule() -> None:
    # Not one of the rule's codes, so the handler reports the general one.
    assert _code(123) == "string_type"


def test_the_leader_email_is_held_to_the_same_rule() -> None:
    with pytest.raises(ValidationError) as caught:
        TeamCreate(name="Platform", leader_email="a@b")
    error = caught.value.errors()[0]
    assert error["loc"] == ("leader_email",)
    assert error["type"] == "employee_email.invalid"

    assert TeamCreate(name="Platform", leader_email=" Lead@Example.com").leader_email == (
        "lead@example.com"
    )
