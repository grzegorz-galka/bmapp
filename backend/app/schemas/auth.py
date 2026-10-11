"""Request and response models for the identity endpoints."""

from pydantic import BaseModel, ConfigDict

from app.schemas.employee import EmployeeEmail


class CurrentUserRead(BaseModel):
    """Who the caller is authenticated as.

    `is_admin` is here because the interface cannot derive it: the
    administrator list is configuration the browser never sees.
    """

    model_config = ConfigDict(from_attributes=True)

    email: str
    is_admin: bool


class DevLogin(BaseModel):
    """A request for a local token in development mode.

    `password` is checked, but it is not a secret: it is derived from the
    email by a published rule (`app.services.dev_login.dev_password`), so it
    keeps a developer deliberate about who they sign in as and protects
    nothing the mode toggle does not already protect.
    """

    email: EmployeeEmail
    password: str


class DevToken(BaseModel):
    """The token a development login returns, in the shape a broker returns."""

    access_token: str
    token_type: str = "Bearer"
