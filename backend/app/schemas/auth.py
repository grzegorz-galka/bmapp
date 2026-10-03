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

    An email and nothing else. There is deliberately no password field: one
    that is sent, named `password` and never checked reads as authentication
    to anyone reviewing the code, while protecting nothing the mode toggle
    does not already protect.
    """

    email: EmployeeEmail


class DevToken(BaseModel):
    """The token a development login returns, in the shape a broker returns."""

    access_token: str
    token_type: str = "Bearer"
