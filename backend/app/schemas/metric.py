"""Request and response models for metrics, thresholds and metric values.

Every number is a `Decimal` and travels as a string, so binary floating point
never comes near a boundary comparison: 71.0 against a boundary of 71 is
green. A number is stored in the metric's unit, exactly as it is shown.
"""

import datetime
import uuid
from dataclasses import dataclass, replace
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

from app.core.exceptions import (
    GENERIC_ERROR_CODE,
    ThresholdOrderError,
    ThresholdShapeError,
    ThresholdToleranceNegativeError,
)
from app.core.metric_enums import Colour, DerivationKind, Direction, Scope, Status
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


class DerivationSourceWrite(BaseModel):
    """One source of a derivation: a metric on the named team's board."""

    team_id: uuid.UUID
    metric_id: uuid.UUID
    #: A weighted mean's weight, above 0; given for no other kind. Checked by
    #: the service, against the kind, so the error names this source.
    weight: ExactDecimal | None = None


class DerivationWrite(BaseModel):
    """How a board's own metric is worked out: a kind over sources, in order.

    How many sources the kind takes, whether each is on its board and whether
    it carries the weight its kind asks for, is checked by the service, which
    knows the boards.
    """

    kind: DerivationKind
    sources: list[DerivationSourceWrite]


class MetricCreate(_MetricFields):
    """A request to add a metric to a board, last in its group or among the ungrouped.

    With `project_id` or `product_id`, the metric belongs to that project or
    product of the team, and is still one of the board's own metrics.
    """

    name: str
    unit: str = ""
    decimals: int = 0
    direction: Direction
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None
    #: Hidden on the board from the start: recorded and counted, with no tile.
    #: Left out, a project's or product's metric is hidden and any other shown.
    hidden: bool | None = None
    #: How the number is worked out, or none: it is typed in.
    derivation: DerivationWrite | None = None
    #: Declared before `project_id`, so that its validator sees both.
    product_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None

    @field_validator("project_id")
    @classmethod
    def not_with_a_product(cls, value: uuid.UUID | None, info: ValidationInfo) -> uuid.UUID | None:
        if value is not None and info.data.get("product_id") is not None:
            raise PydanticCustomError(
                "metric.project_and_product",
                "A metric belongs to a project or a product, not both.",
            )
        return value

    @property
    def hidden_on_arrival(self) -> bool:
        """Whether the metric arrives hidden: as asked, else hidden only with a parent."""
        if self.hidden is not None:
            return self.hidden
        return self.project_id is not None or self.product_id is not None


class MetricChange(_MetricFields):
    """A partial change to a metric. A key that is absent is left alone.

    `group_id: null` takes the metric out of every group and `owner_employee_id:
    null` clears the owner and `derivation: null` removes the derivation; a
    derivation given replaces the one there. The other properties always have
    a value, so null is refused for them. `direction` is accepted only so that
    changing it can be refused by name. A metric's order changes through the
    board's layout.
    """

    name: str | None = None
    unit: str | None = None
    decimals: int | None = None
    direction: Direction | None = None
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None
    retired: bool | None = None
    hidden: bool | None = None
    derivation: DerivationWrite | None = None

    @field_validator("name", "unit", "decimals", "direction", "retired", "hidden")
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
    #: Only this request hides the copy: the source's hiding is its board's.
    hidden: bool = False


class GlobalMetricInclusion(_MetricFields):
    """A request to include a global metric in a board: its placement there."""

    global_metric_id: uuid.UUID
    group_id: uuid.UUID | None = None
    owner_employee_id: uuid.UUID | None = None
    hidden: bool = False


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
    """What a version stores: boundaries, or a non-zero target value's tolerances.

    Which boundaries are set depends on the direction. A version with
    tolerances stores no boundary; `bounds_of` works them out when read.
    """

    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None
    target_value: Decimal | None = None
    green_pct: Decimal | None = None
    amber_pct: Decimal | None = None


BoundInput = Annotated[ExactDecimal | None, Field(default=None)]


class ThresholdCreate(BaseModel):
    """A request to add a threshold version to a metric.

    Every version has a target value. One other than 0 takes `green_pct` and
    `amber_pct`, tolerances in per cent of it, and no boundary. The target
    value 0 takes boundaries instead: a one-sided metric `green` and `amber`,
    the boundary of each zone; a band `green_lo`, `green_hi`, `amber_lo` and
    `amber_hi`. Which shape is right depends on the metric, so it is checked
    by `bounds`, not here.
    """

    effective_from: datetime.date
    reason: str
    target_value: ExactDecimal
    green_pct: BoundInput
    amber_pct: BoundInput
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

    @field_validator(
        "target_value",
        "green_pct",
        "amber_pct",
        "green",
        "amber",
        "green_lo",
        "green_hi",
        "amber_lo",
        "amber_hi",
    )
    @classmethod
    def bound_fits(cls, value: Decimal | None) -> Decimal | None:
        return _bound(value)

    def bounds(self, direction: Direction) -> ThresholdBounds:
        """What to store for a metric of this direction, or the error why not.

        Checked by the target value first, then, for the target value 0, by
        direction. Amber equal to green - in tolerances or boundaries - is
        accepted: it leaves an empty amber zone, which is how a plain
        red-and-green metric is expressed.
        """
        band = ("green_lo", "green_hi", "amber_lo", "amber_hi")
        one_sided = ("green", "amber")
        tolerances = ("green_pct", "amber_pct")
        if self.target_value != 0:
            self._require_shape(required=tolerances, refused=(*one_sided, *band))
            return self._tolerances()
        self._require_shape(required=(), refused=tolerances)
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
        return replace(bounds, target_value=self.target_value)

    def _tolerances(self) -> ThresholdBounds:
        """A non-zero target value's tolerances: never below 0, amber never tighter."""
        green, amber = self.green_pct, self.amber_pct
        assert green is not None and amber is not None  # _require_shape saw to it
        for name, tolerance in (("green_pct", green), ("amber_pct", amber)):
            if tolerance < 0:
                raise ThresholdToleranceNegativeError(name)
        if amber < green:
            raise ThresholdOrderError()
        return ThresholdBounds(target_value=self.target_value, green_pct=green, amber_pct=amber)

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
    #: How the interface names the person; see `app.services.names`.
    display_name: str


class ThresholdRead(BaseModel):
    """One threshold version, with who recorded it and why.

    The four boundaries are the ones the version amounts to, worked out from
    its target value and tolerances where it has them, so every reader draws
    and prints boundaries alike. Worked out exactly, they may have more than
    6 places. Built by `read_threshold`, which knows the metric's direction.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    metric_id: uuid.UUID
    effective_from: datetime.date
    #: None only for a version recorded before target values existed.
    target_value: ExactDecimal | None
    #: Set exactly when the target value is set and not 0.
    green_pct: ExactDecimal | None
    amber_pct: ExactDecimal | None
    green_lo: ExactDecimal | None
    green_hi: ExactDecimal | None
    amber_lo: ExactDecimal | None
    amber_hi: ExactDecimal | None
    reason: str
    recorded_by_email: str
    #: The recorder's display name, derived from the email when they have no
    #: employee record.
    recorded_by_display_name: str
    recorded_at: datetime.datetime


class NamedRead(BaseModel):
    """A team or a metric named in a derivation: its identifier and its name."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class MetricProjectRead(BaseModel):
    """The project a metric belongs to: enough to label it and to tell it is inactive."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    active: bool


class MetricProductRead(BaseModel):
    """The product a metric belongs to: enough to label it and to tell it is inactive."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    active: bool


class _MetricParentRead(BaseModel):
    """The project or product a metric belongs to besides its board, or neither."""

    model_config = ConfigDict(from_attributes=True)

    project: MetricProjectRead | None
    product: MetricProductRead | None


class NamedMetricRead(NamedRead, _MetricParentRead):
    """A metric named in a derivation, with its project or product to label it."""


class DerivationSourceRead(BaseModel):
    """One source of a derivation as read: the team whose board it is on, and the metric."""

    model_config = ConfigDict(from_attributes=True)

    team: NamedRead
    metric: NamedMetricRead
    #: A weighted mean's weight for this source; none for every other kind.
    weight: ExactDecimal | None = None


class DerivationRead(BaseModel):
    """A metric's derivation: its kind and its sources in order."""

    model_config = ConfigDict(from_attributes=True)

    kind: DerivationKind
    sources: list[DerivationSourceRead]


class MetricDefinitionRead(_MetricParentRead):
    """A metric as one board has it, without any threshold.

    Read from the metric's placement on that board: `team_id` is the board
    read, for a global metric too, and `retired` says whether that board
    shows it - retired there, retired in the catalogue, or belonging to an
    inactive project or product.
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
    #: Hidden on this board: active and recorded, but shown as no tile.
    hidden: bool
    #: Retired by an administrator in the catalogue; always false for a
    #: board's own metric. Bringing it back on the board would not show it.
    retired_in_catalogue: bool
    #: How the number is worked out from other metrics, or none. Always none
    #: for a global metric.
    derivation: DerivationRead | None = None


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


class DerivedReading(BaseModel):
    """A source's number at one meeting of its team."""

    meeting_id: uuid.UUID
    date: datetime.date
    value: ExactDecimal


class DerivedSource(DerivedReading):
    """One source as a derived number used it: where it was read, and its number."""

    team: NamedRead
    metric: NamedMetricRead
    #: For a delta, the number at the source team's previous meeting; else none.
    previous: DerivedReading | None
    #: For a weighted mean, the weight this source's number was given; else none.
    weight: ExactDecimal | None = None


class DerivedValue(BaseModel):
    """The number a derivation gives at a meeting, and the numbers it was worked out from.

    Nothing is recorded: the member saves the number as any typed one.
    """

    value: ExactDecimal
    kind: DerivationKind
    sources: list[DerivedSource]


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
    recorded_by_display_name: str | None
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
    #: The number at the team's meeting four meetings before this one, if it has one.
    previous_4: ExactDecimal | None
    change_4: ExactDecimal | None
    improvement_4: bool | None
    sparkline: list[SparklinePoint]


class MissingMetric(_MetricParentRead):
    """An active metric with no number yet at a meeting, labelled with its project or product."""

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
    corrected_by_display_name: str
    corrected_at: datetime.datetime


class MetricTrend(BaseModel):
    """A metric across every meeting of its team, earliest first, with its corrections."""

    metric: MetricDefinitionRead
    points: list[TrendPoint]
    corrections: list[CorrectionRead]
