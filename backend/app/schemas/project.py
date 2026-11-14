"""Request and response models for a team's projects and products.

Texts are trimmed before they are checked, so what is stored is what later
requests are compared against. A change is partial: only the keys present
change, read through `model_fields_set`. Only a product's Jira link can be
cleared with `null`; every other property always has a value.
"""

import datetime
import uuid
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from pydantic_core import PydanticCustomError

from app.core.exceptions import GENERIC_ERROR_CODE
from app.models import (
    PRODUCT_JIRA_URL_MAX_LENGTH,
    PRODUCT_NAME_MAX_LENGTH,
    PROJECT_CODE_MAX_LENGTH,
    PROJECT_NAME_MAX_LENGTH,
)
from app.schemas.employee import EmployeeEmail, normalise_email


def _trimmed(value: object, prefix: str, label: str, max_length: int) -> object:
    """Trim a text and refuse it, under `prefix`, when blank, absent or too long.

    Run before the type check, so that an absent or null text reports the
    published code rather than Pydantic's "missing" or "not a string".
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        raise PydanticCustomError(f"{prefix}.blank", f"{label} must not be blank.")
    if not isinstance(value, str):
        return value
    trimmed = value.strip()
    if len(trimmed) > max_length:
        raise PydanticCustomError(
            f"{prefix}.too_long",
            f"{label} must be at most {{max_length}} characters after trimming.",
            {"max_length": max_length},
        )
    return trimmed


def _jira_url(value: str | None) -> str | None:
    """An absolute http or https address, or none when blank."""
    if value is None or not value.strip():
        return None
    url = value.strip()
    if len(url) > PRODUCT_JIRA_URL_MAX_LENGTH:
        raise PydanticCustomError(
            "product_jira_url.too_long",
            "The Jira link must be at most {max_length} characters.",
            {"max_length": PRODUCT_JIRA_URL_MAX_LENGTH},
        )
    try:
        parts = urlsplit(url)
    except ValueError:
        parts = None
    if (
        parts is None
        or parts.scheme.lower() not in ("http", "https")
        or not parts.hostname
        or any(character.isspace() for character in url)
    ):
        raise PydanticCustomError(
            "product_jira_url.invalid", "The Jira link must be an absolute http or https address."
        )
    return url


def _required(value: object, what: str) -> object:
    if value is None:
        raise PydanticCustomError(GENERIC_ERROR_CODE, f"A {what} always has a value.")
    return value


def _dates_in_order(end_date: datetime.date | None, info: ValidationInfo) -> None:
    start_date = info.data.get("start_date")
    if end_date is not None and start_date is not None and end_date < start_date:
        raise PydanticCustomError(
            "project_dates.order", "The end date must not be before the start date."
        )


class _ProjectFields(BaseModel):
    """The validation a project's properties share whether added or changed."""

    @field_validator("code", mode="before", check_fields=False)
    @classmethod
    def code_trimmed_and_bounded(cls, value: object) -> object:
        return _trimmed(value, "project_code", "Project code", PROJECT_CODE_MAX_LENGTH)

    @field_validator("name", mode="before", check_fields=False)
    @classmethod
    def name_trimmed_and_bounded(cls, value: object) -> object:
        return _trimmed(value, "project_name", "Project name", PROJECT_NAME_MAX_LENGTH)

    @field_validator("start_date", "active", mode="before", check_fields=False)
    @classmethod
    def not_null(cls, value: object) -> object:
        return _required(value, "project")

    @field_validator("end_date", mode="before", check_fields=False)
    @classmethod
    def end_not_null(cls, value: object) -> object:
        return _required(value, "project")

    @field_validator("end_date", check_fields=False)
    @classmethod
    def end_not_before_start(
        cls, value: datetime.date | None, info: ValidationInfo
    ) -> datetime.date | None:
        _dates_in_order(value, info)
        return value


class ProjectCreate(_ProjectFields):
    """A request to add a project to a team. It starts active."""

    code: str = Field(default=None, validate_default=True)
    name: str = Field(default=None, validate_default=True)
    manager_email: EmployeeEmail = Field(description="Email of the project manager.")
    start_date: datetime.date
    #: Declared after `start_date`, so its validator can compare the two.
    end_date: datetime.date


class ProjectChange(_ProjectFields):
    """A partial change to a project, its status included. The team never changes."""

    code: str | None = None
    name: str | None = None
    manager_email: str | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    active: bool | None = None

    @field_validator("manager_email", mode="before")
    @classmethod
    def manager_email_checked(cls, value: object) -> object:
        # The email rule refuses null as blank, as it would refuse "".
        return normalise_email("" if value is None else str(value))


class _ProductFields(BaseModel):
    """The validation a product's properties share whether added or changed."""

    @field_validator("name", mode="before", check_fields=False)
    @classmethod
    def name_trimmed_and_bounded(cls, value: object) -> object:
        return _trimmed(value, "product_name", "Product name", PRODUCT_NAME_MAX_LENGTH)

    @field_validator("jira_url", check_fields=False)
    @classmethod
    def jira_url_absolute(cls, value: str | None) -> str | None:
        return _jira_url(value)

    @field_validator("active", mode="before", check_fields=False)
    @classmethod
    def active_not_null(cls, value: object) -> object:
        return _required(value, "product")


class ProductCreate(_ProductFields):
    """A request to add a product to a team. It starts active."""

    name: str = Field(default=None, validate_default=True)
    owner_email: EmployeeEmail = Field(description="Email of the product owner.")
    jira_url: str | None = None


class ProductChange(_ProductFields):
    """A partial change to a product, its status included. `jira_url: null` clears the link."""

    name: str | None = None
    owner_email: str | None = None
    jira_url: str | None = None
    active: bool | None = None

    @field_validator("owner_email", mode="before")
    @classmethod
    def owner_email_checked(cls, value: object) -> object:
        return normalise_email("" if value is None else str(value))


class PersonRead(BaseModel):
    """A project's manager or a product's owner: an employee, not necessarily a member."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    #: How the interface names the person; see `app.services.names`.
    display_name: str


class ProjectRead(BaseModel):
    """A project with its manager, its status and whether it has run past its end."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    code: str
    name: str
    manager: PersonRead
    start_date: datetime.date
    end_date: datetime.date
    active: bool
    #: Active with an end date before today on the organization's clock.
    past_end: bool


class ProductRead(BaseModel):
    """A product with its owner, its Jira link and its status."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    name: str
    owner: PersonRead
    jira_url: str | None
    active: bool
