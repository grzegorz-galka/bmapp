"""Request and response models for the board schedule and the meetings API.

Dates and times here are wall-clock values in the organization's zone, as
people say them ("Wednesday at 13:00"); the instant a meeting starts is also
returned, in UTC, for anything that needs to compare or count down.
"""

import datetime
import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, PlainSerializer, field_validator
from pydantic_core import PydanticCustomError

from app.core.exceptions import GENERIC_ERROR_CODE


def _minutes_only(value: datetime.time) -> datetime.time:
    """Accept a wall-clock time to the minute, and nothing that carries a zone.

    A zone would contradict the rule that the organization's zone applies, and
    seconds would be silently meaningless on a meeting start; both are
    rejected rather than quietly dropped.
    """
    if value.tzinfo is not None or value.second or value.microsecond:
        raise PydanticCustomError(GENERIC_ERROR_CODE, "Time must be HH:MM, with no zone.")
    return value


#: A time of day as the API reads and writes it: "13:00".
WallClockTime = Annotated[
    datetime.time,
    AfterValidator(_minutes_only),
    PlainSerializer(lambda value: value.strftime("%H:%M"), return_type=str),
]


class ScheduleSet(BaseModel):
    """A request to set a board's weekly meeting schedule."""

    weekday: int
    time: WallClockTime

    @field_validator("weekday")
    @classmethod
    def weekday_in_range(cls, value: int) -> int:
        if not 1 <= value <= 7:
            raise PydanticCustomError(
                "schedule_weekday.out_of_range",
                "Weekday must be an ISO weekday, 1 (Monday) to 7 (Sunday).",
            )
        return value


class ScheduleRead(BaseModel):
    """When a board's team meets each week."""

    model_config = ConfigDict(from_attributes=True)

    weekday: int
    time: WallClockTime


class MeetingOpen(BaseModel):
    """A request to open a meeting."""

    date: datetime.date
    time: WallClockTime


class MeetingChange(BaseModel):
    """A partial change to a meeting: its date, its start time, its host.

    A key that is absent is left alone. `host_employee_id: null` clears the
    host, so absent and null mean different things there and the service
    reads `model_fields_set` to tell them apart. `date` and `time` cannot be
    cleared - a meeting always has both - so null is refused for them.
    """

    date: datetime.date | None = None
    time: WallClockTime | None = None
    host_employee_id: uuid.UUID | None = None

    @field_validator("date", "time")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError(GENERIC_ERROR_CODE, "A meeting always has a date and time.")
        return value


class HostRead(BaseModel):
    """The member hosting a meeting."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str


class MeetingRead(BaseModel):
    """A meeting as the API returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    date: datetime.date
    time: WallClockTime
    starts_at: Annotated[
        datetime.datetime,
        # Always UTC on the wire, whatever zone the value was computed in.
        PlainSerializer(
            lambda value: value.astimezone(datetime.UTC).isoformat().replace("+00:00", "Z"),
            return_type=str,
        ),
    ]
    host: HostRead | None


class ProposedMeeting(BaseModel):
    """The date and start time proposed for a team's next meeting."""

    date: datetime.date
    time: WallClockTime


class MeetingList(BaseModel):
    """A team's meetings, earliest first, with what is needed to open the next."""

    schedule: ScheduleRead | None
    proposed: ProposedMeeting | None
    meetings: list[MeetingRead]
