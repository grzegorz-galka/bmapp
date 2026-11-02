"""Request and response models for the identity endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.employee import EmployeeEmail


class CurrentUserRead(BaseModel):
    """Who the caller is authenticated as.

    `is_admin` is here because the interface cannot derive it: the
    administrator list is configuration the browser never sees. `name` and
    `surname` are what is stored, each possibly none; `display_name` and
    `initials` are what the interface shows, derived from the email when
    nothing is stored.
    """

    model_config = ConfigDict(from_attributes=True)

    email: str
    is_admin: bool
    name: str | None
    surname: str | None
    display_name: str
    initials: str


class DevLogin(BaseModel):
    """A request for a local token in development mode.

    Until a password is chosen, `password` is the one derived from the email
    by a published rule (`app.services.dev_login.dev_password`), and it only
    lets the person choose their own.
    """

    email: EmployeeEmail
    password: str


class DevToken(BaseModel):
    """The token a development login returns, in the shape a broker returns."""

    access_token: str
    token_type: str = "Bearer"


class DevPasswordChangeRequired(BaseModel):
    """A first sign-in's answer: the password was right, but a new one must be chosen.

    A success, not a refusal: nothing was refused, and the window needs the
    proposed name and surname, which an error entry has nowhere to carry.
    Both are null for an administrator with no employee record, which tells
    the window to ask for no name.
    """

    password_change_required: Literal[True] = True
    name: str | None
    surname: str | None


class DevPasswordSet(BaseModel):
    """A request to choose a development password, with the person's name.

    `name` and `surname` are stored trimmed, blank as none, and only on a
    recorded employee. Their length and the new password's rules are checked
    by the service, after the current password and the email, so that a
    refusal names the first thing wrong in that order.
    """

    email: EmployeeEmail
    current_password: str
    new_password: str
    name: str | None = None
    surname: str | None = None
