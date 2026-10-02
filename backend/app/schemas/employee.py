"""The email rule every employee email is held to, wherever it is submitted."""

from typing import Annotated

from pydantic import AfterValidator
from pydantic_core import PydanticCustomError

from app.models import EMAIL_MAX_LENGTH


def normalise_email(value: str) -> str:
    """Trim and lower-case an email, then reject it if it breaks the rule.

    A short explicit rule rather than `EmailStr`: the addresses are corporate
    mail entered by colleagues, and the full RFC handling of `email-validator`
    would remove no code BMAPP needs. Lower-casing the whole address,
    local part included, keeps one spelling per person, which is what the
    identity broker's claim will be matched against.
    """
    email = value.strip().lower()
    if not email:
        raise PydanticCustomError("employee_email.blank", "Email must not be blank.")
    if len(email) > EMAIL_MAX_LENGTH:
        raise PydanticCustomError(
            "employee_email.too_long",
            "Email must be at most {max_length} characters after trimming.",
            {"max_length": EMAIL_MAX_LENGTH},
        )
    if not _is_well_formed(email):
        raise PydanticCustomError("employee_email.invalid", "Email is not a valid address.")
    return email


def _is_well_formed(email: str) -> bool:
    """One @, something before it, and a domain with a dot inside it."""
    if any(character.isspace() for character in email) or email.count("@") != 1:
        return False
    local, domain = email.split("@")
    return bool(local) and "." in domain[1:-1]


#: An email as every request model accepts it: trimmed, lower-cased, checked.
EmployeeEmail = Annotated[str, AfterValidator(normalise_email)]
