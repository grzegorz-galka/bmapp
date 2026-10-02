"""Request and response models for the team-board and team-membership API."""

import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from app.models import TEAM_NAME_MAX_LENGTH
from app.schemas.employee import EmployeeEmail


class TeamCreate(BaseModel):
    """A request to register a team."""

    name: str = Field(description="Team name, unique regardless of case.")
    leader_email: EmployeeEmail = Field(
        description="Email of the team's leader, who becomes its first member."
    )

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
            # PydanticCustomError carries the published code as its type, which
            # is where the exception handler reads it from.
            raise PydanticCustomError("team_name.blank", "Team name must not be blank.")
        if len(trimmed) > TEAM_NAME_MAX_LENGTH:
            raise PydanticCustomError(
                "team_name.too_long",
                "Team name must be at most {max_length} characters after trimming.",
                {"max_length": TEAM_NAME_MAX_LENGTH},
            )
        return trimmed


class MemberAdd(BaseModel):
    """A request to add an employee to a team by email."""

    email: EmployeeEmail


class LeaderChange(BaseModel):
    """A request to make one of a team's members its leader."""

    employee_id: uuid.UUID


class BoardRead(BaseModel):
    """A board definition as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class LeaderRead(BaseModel):
    """The employee who leads a team."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str


class TeamRead(BaseModel):
    """A team, with the board it owns, its leader and its size."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    board: BoardRead
    leader: LeaderRead
    member_count: int


class MemberRead(BaseModel):
    """One member of a team."""

    model_config = ConfigDict(from_attributes=True)

    employee_id: uuid.UUID
    email: str
    is_leader: bool


def _by_email(members: list[MemberRead]) -> list[MemberRead]:
    return sorted(members, key=lambda member: member.email)


class TeamDetail(BaseModel):
    """A team with its full member list, ordered by email."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    board: BoardRead
    # Sorted here because the order is part of the published response, and
    # the collection loaded from the database carries none.
    members: Annotated[list[MemberRead], AfterValidator(_by_email)]
