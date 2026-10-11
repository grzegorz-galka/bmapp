"""Request and response models for the pulse check.

An average travels as a string with exactly two decimal places, rounded half
up only when written: the colour is decided on the exact value beforehand, so
3.995 is amber even though it reads "4.00".
"""

import datetime
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer, field_validator
from pydantic_core import PydanticCustomError

from app.core.metric_enums import Status
from app.models import PULSE_RATING_MAX, PULSE_RATING_MIN, PULSE_TEXT_MAX_LENGTH

_HUNDREDTHS = Decimal("0.01")


def _two_places(value: Decimal) -> str:
    """A decimal rounded half up to two places: "3.57", "-0.23", never "-0.00"."""
    text = format(value.quantize(_HUNDREDTHS, rounding=ROUND_HALF_UP), "f")
    return "0.00" if text == "-0.00" else text


#: An average or a change as the API writes it.
TwoPlaces = Annotated[Decimal, PlainSerializer(_two_places, return_type=str)]


class PulseAnswerWrite(BaseModel):
    """A member's own answer at a meeting. Replaces their earlier one.

    The rating is a strict integer: 3.5 and "4" are refused rather than
    coerced, and so is an absent rating, all with the one published code.
    A text that is absent, null or blank is stored as ''.
    """

    # Defaulted and validated so that an absent rating reaches the validator
    # and reports `pulse_rating.out_of_range` rather than Pydantic's "missing".
    rating: int = Field(default=None, validate_default=True)
    positive: str = ""
    negative: str = ""
    better: str = ""

    @field_validator("rating", mode="plain")
    @classmethod
    def rating_in_range(cls, value: object) -> int:
        # `type(...) is int` rather than isinstance: a bool is an int in Python.
        if type(value) is not int or not PULSE_RATING_MIN <= value <= PULSE_RATING_MAX:
            raise PydanticCustomError(
                "pulse_rating.out_of_range",
                "Rating must be a whole number from {min} to {max}.",
                {"min": PULSE_RATING_MIN, "max": PULSE_RATING_MAX},
            )
        return value

    @field_validator("positive", "negative", "better", mode="before")
    @classmethod
    def null_as_empty(cls, value: object) -> object:
        return "" if value is None else value

    @field_validator("positive", "negative", "better")
    @classmethod
    def text_trimmed_and_bounded(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) > PULSE_TEXT_MAX_LENGTH:
            raise PydanticCustomError(
                "pulse_text.too_long",
                "Text must be at most {max_length} characters after trimming.",
                {"max_length": PULSE_TEXT_MAX_LENGTH},
            )
        return trimmed


class PulseAnswerRead(BaseModel):
    """One member's answer at a meeting, with the colour of its rating."""

    employee_id: uuid.UUID
    email: str
    rating: int
    status: Status
    positive: str
    negative: str
    better: str
    updated_at: datetime.datetime


class PulsePrevious(BaseModel):
    """The team's latest earlier meeting with at least one answer."""

    meeting_id: uuid.UUID
    date: datetime.date
    average: TwoPlaces


class PulseTrendPoint(BaseModel):
    """The pulse check at one meeting of the team."""

    meeting_id: uuid.UUID
    date: datetime.date
    average: TwoPlaces | None
    status: Status
    answered: int


class PulseMissingMember(BaseModel):
    """A current member of the team who has not answered at the meeting."""

    employee_id: uuid.UUID
    email: str


class PulseResults(BaseModel):
    """The pulse check of one meeting, computed when read.

    `answers`, `missing` and `own` are null - not empty - when the viewer may
    not read names, so a client can tell "you may not see this" from "nobody
    answered". `missing_count` is always present for the card shown without
    names.
    """

    meeting_id: uuid.UUID
    editable: bool
    answered: int
    members: int
    average: TwoPlaces | None
    status: Status
    previous: PulsePrevious | None
    change: TwoPlaces | None
    #: How many answers gave each rating, every rating 1 to 5 present.
    distribution: dict[int, int]
    #: At most 16 meetings with answers, in date order, ending at this meeting.
    trend: list[PulseTrendPoint]
    answers: list[PulseAnswerRead] | None
    missing: list[PulseMissingMember] | None
    missing_count: int
    own: PulseAnswerRead | None
