"""Request and response models for metrics, thresholds and metric values.

Every number is a `Decimal` and travels as a string, so binary floating point
never comes near a boundary comparison: 71.0 against a boundary of 71 is
green. A number is stored in the metric's unit, exactly as it is shown.
"""

import datetime
import uuid
from dataclasses import dataclass
from decimal import Decimal
from itertools import pairwise
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    ValidationInfo,
    field_validator,
)
from pydantic_core import PydanticCustomError

from app.core.exceptions import GENERIC_ERROR_CODE, ThresholdOrderError, ThresholdShapeError
from app.core.metric_enums import Colour, Direction, Scope, Status
from app.models import (
    METRIC_DECIMALS_MAX,
    METRIC_GROUP_MAX_LENGTH,
    METRIC_NAME_MAX_LENGTH,
    METRIC_UNIT_MAX_LENGTH,
)
from app.schemas.meeting import MeetingRead

#: The largest magnitude and finest precision a stored number can hold.
NUMBER_LIMIT = Decimal(10) ** 15
NUMBER_PLACES = 6


def _canonical(value: Decimal) -> str:
    """A decimal as plain digits with no trailing zeros: "95.3", never "9.53E+1"."""
    text = format(value.normalize(), "f")
    return "0" if text == "-0" else text


#: A number as the API writes it: a string of plain decimal digits. Read from a
#: string or a JSON number alike; Pydantic converts a number through its
#: shortest decimal form, so 95.3 arrives as exactly 95.3.
ExactDecimal = Annotated[Decimal, PlainSerializer(_canonical, return_type=str)]


def fits_a_stored_number(value: Decimal) -> bool:
    """Under 10^15 in magnitude and at most 6 decimal places, as NUMERIC(21, 6) holds."""
    exponent = value.normalize().as_tuple().exponent
    places = -exponent if isinstance(exponent, int) and exponent < 0 else 0
    return abs(value) < NUMBER_LIMIT and places <= NUMBER_PLACES


def _bound(value: Decimal | None) -> Decimal | None:
    if value is not None and not fits_a_stored_number(value):
        raise PydanticCustomError(
            GENERIC_ERROR_CODE, "A boundary must be under 10^15 with at most 6 decimal places."
        )
    return value


def _strip_or_none(value: str | None) -> str | None:
    """Trim text, treating blank as absent."""
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class _MetricFields(BaseModel):
    """The validation a metric's properties share whether added or changed."""

    @field_validator("name", check_fields=False)
    @classmethod
    def name_trimmed_and_bounded(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError("metric_name.blank", "Metric name must not be blank.")
        if len(trimmed) > METRIC_NAME_MAX_LENGTH:
            raise PydanticCustomError(
                "metric_name.too_long",
                "Metric name must be at most {max_length} characters after trimming.",
                {"max_length": METRIC_NAME_MAX_LENGTH},
            )
        return trimmed

    @field_validator("unit", check_fields=False)
    @classmethod
    def unit_trimmed_and_bounded(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if len(trimmed) > METRIC_UNIT_MAX_LENGTH:
            raise PydanticCustomError(
                "metric_unit.too_long",
                "Unit must be at most {max_length} characters.",
                {"max_length": METRIC_UNIT_MAX_LENGTH},
            )
        return trimmed

    @field_validator("decimals", check_fields=False)
    @classmethod
    def decimals_in_range(cls, value: int | None) -> int | None:
        if value is not None and not 0 <= value <= METRIC_DECIMALS_MAX:
            raise PydanticCustomError(
                "metric_decimals.out_of_range",
                "Decimals must be 0 to {max}.",
                {"max": METRIC_DECIMALS_MAX},
            )
        return value


class MetricCreate(_MetricFields):
    """A request to add a metric to a board, last in its group or among the ungrouped."""

    name: str
    unit: str = ""
    decimals: int = 0
    direction: Direction
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None


class MetricChange(_MetricFields):
    """A partial change to a metric. A key that is absent is left alone.

    `group_id: null` takes the metric out of every group and `owner_employee_id:
    null` clears the owner; the other properties always have a value, so null
    is refused for them. `direction` is accepted only so that changing it can
    be refused by name. A metric's order changes through the board's layout.
    """

    name: str | None = None
    unit: str | None = None
    decimals: int | None = None
    direction: Direction | None = None
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None
    retired: bool | None = None

    @field_validator("name", "unit", "decimals", "direction", "retired")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError(GENERIC_ERROR_CODE, "This property cannot be cleared.")
        return value


class GlobalMetricCreate(_MetricFields):
    """A request to add a metric to the company-wide catalogue.

    Only the definition: where a board shows it and who owns it there are
    each including board's own business.
    """

    name: str
    unit: str = ""
    decimals: int = 0
    direction: Direction


class GlobalMetricChange(_MetricFields):
    """A partial change to a global metric. A key that is absent is left alone.

    `direction` is accepted only so that changing it can be refused by name.
    """

    name: str | None = None
    unit: str | None = None
    decimals: int | None = None
    direction: Direction | None = None
    retired: bool | None = None

    @field_validator("name", "unit", "decimals", "direction", "retired")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise PydanticCustomError(GENERIC_ERROR_CODE, "This property cannot be cleared.")
        return value


class MetricCopy(_MetricFields):
    """A request to copy another board's own metric onto this board.

    `name` renames the copy on the way in; absent, the source's name is kept.
    The source's group belongs to its own board, so the copy goes into the
    group named here, or among the ungrouped metrics.
    """

    source_metric_id: uuid.UUID
    name: str | None = None
    group_id: uuid.UUID | None = None


class GlobalMetricInclusion(_MetricFields):
    """A request to include a global metric in a board: its placement there."""

    global_metric_id: uuid.UUID
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None


class _MetricGroupName(BaseModel):
    """A group's name: trimmed, not blank, at most the stored length."""

    name: str

    @field_validator("name")
    @classmethod
    def name_trimmed_and_bounded(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError("metric_group_name.blank", "Group name must not be blank.")
        if len(trimmed) > METRIC_GROUP_MAX_LENGTH:
            raise PydanticCustomError(
                "metric_group_name.too_long",
                "Group name must be at most {max_length} characters after trimming.",
                {"max_length": METRIC_GROUP_MAX_LENGTH},
            )
        return trimmed


class MetricGroupCreate(_MetricGroupName):
    """A request to add a group to a board, after its other groups."""


class MetricGroupRename(_MetricGroupName):
    """A request to rename a board's group."""


class MetricGroupRead(BaseModel):
    """A board's group: its name and its place among the board's groups."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int


class MetricLayoutGroup(BaseModel):
    """One group of a layout and the metrics in it, in order."""

    id: uuid.UUID
    metric_ids: list[uuid.UUID]


class MetricLayout(BaseModel):
    """A board's whole arrangement: every group in order, every metric in its place.

    Retired metrics included: they keep their place for when they come back.
    """

    groups: list[MetricLayoutGroup]
    ungrouped: list[uuid.UUID]


@dataclass(frozen=True, slots=True)
class ThresholdBounds:
    """The four stored boundaries; which are set depends on the direction."""

    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


BoundInput = Annotated[ExactDecimal | None, Field(default=None)]


class ThresholdCreate(BaseModel):
    """A request to add a threshold version to a metric.

    A one-sided metric takes `green` and `amber`, the boundary of each zone; a
    band takes `green_lo`, `green_hi`, `amber_lo` and `amber_hi`. Which shape
    is right depends on the metric, so it is checked by `bounds`, not here.
    """

    effective_from: datetime.date
    reason: str
    green: BoundInput
    amber: BoundInput
    green_lo: BoundInput
    green_hi: BoundInput
    amber_lo: BoundInput
    amber_hi: BoundInput

    @field_validator("reason")
    @classmethod
    def reason_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError("threshold_reason.blank", "A threshold needs a reason.")
        return trimmed

    @field_validator("green", "amber", "green_lo", "green_hi", "amber_lo", "amber_hi")
    @classmethod
    def bound_fits(cls, value: Decimal | None) -> Decimal | None:
        return _bound(value)

    def bounds(self, direction: Direction) -> ThresholdBounds:
        """The stored boundaries for a metric of this direction, or the error why not.

        Amber equal to green is accepted: it leaves an empty amber zone, which
        is how a plain red-and-green metric is expressed.
        """
        band = ("green_lo", "green_hi", "amber_lo", "amber_hi")
        one_sided = ("green", "amber")
        if direction is Direction.WITHIN_BAND:
            self._require_shape(required=band, refused=one_sided)
            bounds = ThresholdBounds(self.green_lo, self.green_hi, self.amber_lo, self.amber_hi)
        else:
            self._require_shape(required=one_sided, refused=band)
            if direction is Direction.HIGHER_IS_BETTER:
                bounds = ThresholdBounds(green_lo=self.green, amber_lo=self.amber)
            else:
                bounds = ThresholdBounds(green_hi=self.green, amber_hi=self.amber)
        if not _ordered(bounds.amber_lo, bounds.green_lo, bounds.green_hi, bounds.amber_hi):
            raise ThresholdOrderError()
        return bounds

    def _require_shape(self, *, required: tuple[str, ...], refused: tuple[str, ...]) -> None:
        for name in refused:
            if getattr(self, name) is not None:
                raise ThresholdShapeError(name, f"{name} does not apply to this metric.")
        for name in required:
            if getattr(self, name) is None:
                raise ThresholdShapeError(name, f"{name} is required for this metric.")


def _ordered(*bounds: Decimal | None) -> bool:
    """Whether the boundaries that are set never decrease, left to right."""
    present = [bound for bound in bounds if bound is not None]
    return all(low <= high for low, high in pairwise(present))


class MetricValueWrite(BaseModel):
    """What is recorded for a metric at a meeting. Replaces what was there.

    The three properties are required, null included, so a write is never
    ambiguous between "leave alone" and "clear". `reason` is read only for an
    administrator's correction at a frozen meeting.
    """

    value: ExactDecimal | None
    manual_status: Colour | None
    comment: str | None
    reason: str | None = None

    @field_validator("value")
    @classmethod
    def value_fits(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and not fits_a_stored_number(value):
            raise PydanticCustomError(
                "metric_value.out_of_range",
                "A value must be under 10^15 with at most 6 decimal places.",
            )
        return value

    @field_validator("comment")
    @classmethod
    def comment_with_a_colour_set_by_hand(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        """A colour set by hand needs a comment: it says what the number does not."""
        comment = _strip_or_none(value)
        if comment is None and info.data.get("manual_status") is not None:
            raise PydanticCustomError(
                "metric_value.comment_required", "A colour set by hand needs a comment."
            )
        return comment

    @field_validator("reason")
    @classmethod
    def reason_trimmed(cls, value: str | None) -> str | None:
        return _strip_or_none(value)


class OwnerRead(BaseModel):
    """The member who owns a metric."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str


class ThresholdRead(BaseModel):
    """One threshold version, with who recorded it and why."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    metric_id: uuid.UUID
    effective_from: datetime.date
    green_lo: ExactDecimal | None
    green_hi: ExactDecimal | None
    amber_lo: ExactDecimal | None
    amber_hi: ExactDecimal | None
    reason: str
    recorded_by_email: str
    recorded_at: datetime.datetime


class MetricDefinitionRead(BaseModel):
    """A metric as one board has it, without any threshold.

    Read from the metric's placement on that board: `team_id` is the board
    read, for a global metric too, and `retired` says whether that board
    shows it - retired there, or retired in the catalogue.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    #: Whether the metric is the board's own or a global one it includes.
    scope: Scope
    name: str
    unit: str
    decimals: int
    direction: Direction
    #: The board's group the metric is in, or none: it is then ungrouped.
    group: MetricGroupRead | None
    #: Within its group, or among the ungrouped metrics.
    position: int
    owner: OwnerRead | None
    retired: bool
    #: Retired by an administrator in the catalogue; always false for a
    #: board's own metric. Bringing it back on the board would not show it.
    retired_in_catalogue: bool


class MetricRead(MetricDefinitionRead):
    """A metric as the settings list it, with the threshold in force today."""

    threshold: ThresholdRead | None


class GlobalMetricRead(BaseModel):
    """A global metric as the catalogue lists it, with no board's placement."""

    id: uuid.UUID
    scope: Literal[Scope.GLOBAL] = Scope.GLOBAL
    name: str
    unit: str
    decimals: int
    direction: Direction
    retired: bool
    #: The version in force today, or none.
    threshold: ThresholdRead | None
    #: How many boards include it.
    boards: int


class MetricValueRead(BaseModel):
    """What is recorded for a metric at a meeting, and the status it gives."""

    metric_id: uuid.UUID
    meeting_id: uuid.UUID
    value: ExactDecimal | None
    manual_status: Colour | None
    comment: str | None
    status: Status
    set_by_hand: bool
    #: None once a write has cleared all three properties: nothing is recorded.
    recorded_by_email: str | None
    recorded_at: datetime.datetime | None


class SparklinePoint(BaseModel):
    """A metric at one of the team's recent meetings."""

    meeting_id: uuid.UUID
    date: datetime.date
    value: ExactDecimal | None
    status: Status


class BoardMetric(BaseModel):
    """One tile of a meeting's board."""

    metric: MetricDefinitionRead
    threshold: ThresholdRead | None
    value: ExactDecimal | None
    status: Status
    set_by_hand: bool
    comment: str | None
    manual_status: Colour | None
    #: The number at the team's immediately preceding meeting, if it has one.
    previous: ExactDecimal | None
    change: ExactDecimal | None
    #: True or False for a one-sided metric; None for a band, or with no change.
    improvement: bool | None
    sparkline: list[SparklinePoint]


class MissingMetric(BaseModel):
    """An active metric with no number yet at a meeting."""

    metric_id: uuid.UUID
    name: str
    owner: OwnerRead | None


class Completeness(BaseModel):
    """How many active metrics have a number at a meeting, which do not, and who owes data."""

    recorded: int
    total: int
    missing: list[MissingMetric]
    #: How many people owe data for the meeting, as `owing_by_meeting` counts them.
    owing: int


class MeetingBoard(BaseModel):
    """A team's board at one meeting: every active metric, and whether it can be edited."""

    meeting: MeetingRead
    editable: bool
    completeness: Completeness
    metrics: list[BoardMetric]


class TrendPoint(BaseModel):
    """A metric at one meeting of its team, judged against the threshold then in force."""

    meeting_id: uuid.UUID
    date: datetime.date
    value: ExactDecimal | None
    status: Status
    set_by_hand: bool
    manual_status: Colour | None
    comment: str | None
    threshold: ThresholdRead | None


class CorrectionRead(BaseModel):
    """One administrator's correction to a frozen value."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    old_value: ExactDecimal | None
    old_manual_status: Colour | None
    old_comment: str | None
    new_value: ExactDecimal | None
    new_manual_status: Colour | None
    new_comment: str | None
    reason: str
    corrected_by_email: str
    corrected_at: datetime.datetime


class MetricTrend(BaseModel):
    """A metric across every meeting of its team, earliest first, with its corrections."""

    metric: MetricDefinitionRead
    points: list[TrendPoint]
    corrections: list[CorrectionRead]
