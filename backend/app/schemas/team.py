"""Request and response models for the team-board API."""

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import TEAM_NAME_MAX_LENGTH


class TeamCreate(BaseModel):
    """A request to register a team."""

    name: str = Field(description="Team name, unique regardless of case.")

    @field_validator("name")
    @classmethod
    def strip_and_require_name(cls, value: str) -> str:
        """Trim the name, then reject it if it is blank or too long.

        Validation runs on the trimmed value so that a name padded past the
        limit is not accepted, and so that what is stored is what later
        registrations are compared against.
        """
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Team name must not be blank.")
        if len(trimmed) > TEAM_NAME_MAX_LENGTH:
            raise ValueError(
                f"Team name must be at most {TEAM_NAME_MAX_LENGTH} characters after trimming."
            )
        return trimmed


class BoardRead(BaseModel):
    """A board definition as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TeamRead(BaseModel):
    """A team, with the board it owns, as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    board: BoardRead
