"""Application configuration, read from the environment."""

from collections.abc import Iterable
from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Mode(StrEnum):
    """How identity is established.

    The two modes never overlap: `broker` accepts only tokens the identity
    broker signed, `dev` only tokens this process signed. A token minted in one
    cannot be accepted by the other, which is what makes dev mode impossible to
    use against a deployed server rather than merely discouraged.
    """

    BROKER = "broker"
    DEV = "dev"


class Settings(BaseSettings):
    """Settings for the backend, overridable by BMAPP_-prefixed variables."""

    model_config = SettingsConfigDict(env_prefix="BMAPP_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://bmapp:bmapp@localhost:5432/bmapp"
    # Localhost only by default. Until this change is deployed and verified,
    # binding to 0.0.0.0 would expose board material to the network.
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    frontend_origin: str = "http://localhost:5173"

    #: Broker unless deliberately switched to dev. The default is the safe one,
    #: so forgetting to set it cannot turn the local login on.
    mode: Mode = Mode.BROKER

    #: The identity broker that signs access tokens, and what it must claim.
    oidc_issuer: str = ""
    oidc_client_id: str = "bmapp"
    #: The audience a token must name to be accepted here. Empty means "use the
    #: client id", which is what most brokers issue for a public client.
    oidc_audience: str = ""

    #: Emails of the administrators, comma-separated. An empty list refuses
    #: every write that needs an administrator rather than permitting it.
    #:
    #: NoDecode because a set is a "complex" type to pydantic-settings, which
    #: would otherwise try to read the environment variable as JSON and fail
    #: on a plain comma-separated list before the validator below ever runs.
    admin_emails: Annotated[frozenset[str], NoDecode] = frozenset()

    @field_validator("admin_emails", mode="before")
    @classmethod
    def _split_admin_emails(cls, value: object) -> object:
        """Accept a comma-separated string, trimmed and lower-cased.

        The same normalisation employee emails are stored under, so an address
        configured in a different spelling still matches the claim the broker
        sends. Only normalisation, not the employee email rule: that rule lives
        with the models, which read this module for the database URL, and these
        are addresses written by whoever deploys rather than submitted input.
        A malformed entry simply matches nobody, and the count logged at startup
        is what makes a mistake visible. Blank entries are dropped rather than
        rejected, so a trailing comma does not stop the server.
        """
        if isinstance(value, str):
            value = value.split(",")
        if isinstance(value, Iterable) and not isinstance(value, str | bytes):
            return frozenset(
                entry.strip().lower() for entry in value if isinstance(entry, str) and entry.strip()
            )
        return value

    @property
    def audience(self) -> str:
        """What a token must name as its audience: the override, or the client id."""
        return self.oidc_audience or self.oidc_client_id


@lru_cache
def get_settings() -> Settings:
    """Return the settings, read once per process."""
    return Settings()
