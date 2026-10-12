"""Request and response models for a team's problems and tasks.

Texts are trimmed; a blank optional text is stored as ''. A change is partial:
only the keys present change, read through `model_fields_set`, and `null`
clears an optional field. `stage` is always the target stage, never "the
next one", so the same change sent twice lands on the same stage.
"""

import datetime
import uuid

from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

from app.core.exceptions import GENERIC_ERROR_CODE
from app.core.item_enums import Stage
from app.models import ITEM_SUMMARY_MAX_LENGTH, ITEM_TEXT_MAX_LENGTH


def _blank_summary() -> PydanticCustomError:
    return PydanticCustomError("item_summary.blank", "Summary must not be blank.")


class _ItemFields(BaseModel):
    """The validation both kinds share, whether raised or changed."""

    @field_validator("summary", mode="before", check_fields=False)
    @classmethod
    def summary_present(cls, value: object) -> object:
        # Before the type check, so that an absent or null summary reports the
        # published code rather than Pydantic's "missing" or "not a string".
        if value is None or (isinstance(value, str) and not value.strip()):
            raise _blank_summary()
        return value

    @field_validator("summary", check_fields=False)
    @classmethod
    def summary_trimmed_and_bounded(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) > ITEM_SUMMARY_MAX_LENGTH:
            raise PydanticCustomError(
                "item_summary.too_long",
                "Summary must be at most {max_length} characters after trimming.",
                {"max_length": ITEM_SUMMARY_MAX_LENGTH},
            )
        return trimmed

    @field_validator("reason", "solution", "details", mode="before", check_fields=False)
    @classmethod
    def null_text_as_empty(cls, value: object) -> object:
        return "" if value is None else value

    @field_validator("reason", "solution", "details", check_fields=False)
    @classmethod
    def text_trimmed_and_bounded(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) > ITEM_TEXT_MAX_LENGTH:
            raise PydanticCustomError(
                "item_text.too_long",
                "Text must be at most {max_length} characters after trimming.",
                {"max_length": ITEM_TEXT_MAX_LENGTH},
            )
        return trimmed

    @field_validator("stage", mode="before", check_fields=False)
    @classmethod
    def stage_not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError(GENERIC_ERROR_CODE, "An item always has a stage.")
        return value


class ProblemCreate(_ItemFields):
    """A request to raise a problem. Only the summary is required."""

    # Defaulted and validated so that an absent summary reaches the validator
    # and reports `item_summary.blank`, as a blank one does.
    summary: str = Field(default=None, validate_default=True)
    reason: str = ""
    solution: str = ""
    responsible_employee_id: uuid.UUID | None = None
    due_on: datetime.date | None = None
    metric_id: uuid.UUID | None = None
    stage: Stage = Stage.NOT_STARTED


class ProblemChange(_ItemFields):
    """A partial change to an active problem. A key that is absent is left alone.

    `null` clears the responsible person, the due date, the metric and the
    texts; the summary and the stage cannot be cleared.
    """

    summary: str | None = None
    reason: str | None = None
    solution: str | None = None
    responsible_employee_id: uuid.UUID | None = None
    due_on: datetime.date | None = None
    metric_id: uuid.UUID | None = None
    stage: Stage | None = None


class TaskCreate(_ItemFields):
    """A request to raise a task, optionally from an active problem of the same team."""

    summary: str = Field(default=None, validate_default=True)
    details: str = ""
    responsible_employee_id: uuid.UUID | None = None
    due_on: datetime.date | None = None
    metric_id: uuid.UUID | None = None
    problem_id: uuid.UUID | None = None
    stage: Stage = Stage.NOT_STARTED


class TaskChange(_ItemFields):
    """A partial change to an active task. `problem_id: null` detaches it from its problem."""

    summary: str | None = None
    details: str | None = None
    responsible_employee_id: uuid.UUID | None = None
    due_on: datetime.date | None = None
    metric_id: uuid.UUID | None = None
    problem_id: uuid.UUID | None = None
    stage: Stage | None = None


class ItemResponsible(BaseModel):
    """The member responsible for an item, by email as everywhere in BMAPP."""

    employee_id: uuid.UUID
    email: str


class ItemMetric(BaseModel):
    """The metric of the board an item concerns."""

    id: uuid.UUID
    name: str


class ItemMeeting(BaseModel):
    """A meeting at which an item was raised or closed."""

    id: uuid.UUID
    date: datetime.date


class TaskProblem(BaseModel):
    """The problem a task was raised from."""

    id: uuid.UUID
    summary: str


class _ItemRead(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    summary: str
    responsible: ItemResponsible | None
    due_on: datetime.date | None
    metric: ItemMetric | None
    stage: Stage
    #: Closed, and so read-only: the same fact as `stage == "act"`.
    archived: bool
    #: Due before today in the organization's zone, and still active.
    overdue: bool
    raised_at: datetime.datetime
    raised_meeting: ItemMeeting | None
    closed_at: datetime.datetime | None
    closed_meeting: ItemMeeting | None
    updated_at: datetime.datetime


class ProblemRead(_ItemRead):
    """A problem as the API returns it."""

    reason: str
    solution: str


class TaskRead(_ItemRead):
    """A task as the API returns it."""

    details: str
    problem: TaskProblem | None
