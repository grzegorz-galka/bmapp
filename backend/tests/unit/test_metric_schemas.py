"""The metric, threshold and value request schemas, and the codes they report. No I/O."""

import datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.exceptions import (
    ThresholdOrderError,
    ThresholdShapeError,
    ThresholdToleranceNegativeError,
)
from app.core.metric_enums import Colour, DerivationKind, Direction
from app.main import _validation_code
from app.schemas import (
    DerivedValue,
    GlobalMetricChange,
    GlobalMetricCreate,
    GlobalMetricInclusion,
    GlobalMetricRead,
    MetricChange,
    MetricCopy,
    MetricCreate,
    MetricDefinitionRead,
    MetricGroupCreate,
    MetricGroupRename,
    MetricValueWrite,
    ThresholdBounds,
    ThresholdCreate,
    ThresholdRead,
)
from app.services.metrics import read_threshold


def _published_code(model: type, **fields: object) -> tuple[tuple[object, ...], str]:
    """The field and code the API would report for these fields."""
    with pytest.raises(ValidationError) as caught:
        model(**fields)
    error = caught.value.errors()[0]
    return error["loc"], _validation_code(str(error["type"]))


def _metric(**fields: Any) -> dict[str, Any]:
    return {"name": "Revenue", "direction": "higher_is_better", **fields}


# Define a metric on a board


def test_a_metric_is_trimmed_and_defaults_its_optional_properties() -> None:
    metric = MetricCreate(**_metric(name="  Revenue  ", unit=" mln zł "))

    assert (metric.name, metric.unit, metric.group_id) == ("Revenue", "mln zł", None)
    assert (metric.decimals, metric.owner_employee_id) == (0, None)


def test_a_metric_is_placed_by_group_not_by_label_or_position() -> None:
    assert {"group_label", "position"}.isdisjoint(MetricCreate.model_fields)
    assert _published_code(MetricCreate, **_metric(group_id="Quality")) == (
        ("group_id",),
        "request.invalid_field",
    )


@pytest.mark.parametrize(
    ("name", "code"),
    [("   ", "metric_name.blank"), ("x" * 201, "metric_name.too_long")],
)
def test_name_is_blank_or_too_long(name: str, code: str) -> None:
    assert _published_code(MetricCreate, **_metric(name=name)) == (("name",), code)


def test_a_name_of_200_characters_is_accepted() -> None:
    assert len(MetricCreate(**_metric(name="x" * 200)).name) == 200


def test_unit_over_20_characters() -> None:
    assert _published_code(MetricCreate, **_metric(unit="x" * 21)) == (
        ("unit",),
        "metric_unit.too_long",
    )


@pytest.mark.parametrize("decimals", [-1, 7])
def test_decimals_out_of_bounds(decimals: int) -> None:
    assert _published_code(MetricCreate, **_metric(decimals=decimals)) == (
        ("decimals",),
        "metric_decimals.out_of_range",
    )


def test_unknown_direction() -> None:
    assert _published_code(MetricCreate, **_metric(direction="sideways")) == (
        ("direction",),
        "request.invalid_field",
    )


# Define a board's metric groups


def test_a_group_name_is_trimmed() -> None:
    assert MetricGroupCreate(name="  Quality ").name == "Quality"
    assert MetricGroupRename(name=" Finance  ").name == "Finance"


@pytest.mark.parametrize(
    ("name", "code"),
    [("   ", "metric_group_name.blank"), ("x" * 201, "metric_group_name.too_long")],
)
@pytest.mark.parametrize("model", [MetricGroupCreate, MetricGroupRename])
def test_group_name_is_blank_or_too_long(model: type, name: str, code: str) -> None:
    assert _published_code(model, name=name) == (("name",), code)


def test_a_group_name_of_200_characters_is_accepted() -> None:
    assert len(MetricGroupCreate(name="x" * 200).name) == 200


# Change a metric


def test_a_change_validates_like_an_addition() -> None:
    assert _published_code(MetricChange, name=" ") == (("name",), "metric_name.blank")


@pytest.mark.parametrize("field", ["name", "unit", "decimals", "direction", "retired", "hidden"])
def test_a_property_that_always_has_a_value_cannot_be_cleared(field: str) -> None:
    assert _published_code(MetricChange, **{field: None}) == ((field,), "request.invalid_field")


def test_a_metric_is_added_shown_unless_asked_to_hide_it() -> None:
    assert MetricCreate(**_metric()).hidden is False
    assert MetricCreate(**_metric(hidden=True)).hidden is True
    assert MetricCopy(source_metric_id=SOURCE).hidden is False  # type: ignore[arg-type]
    assert GlobalMetricInclusion(global_metric_id=SOURCE).hidden is False  # type: ignore[arg-type]


def test_group_and_owner_can_be_cleared() -> None:
    change = MetricChange(group_id=None, owner_employee_id=None)

    assert change.model_fields_set == {"group_id", "owner_employee_id"}


# A metric's derivation

TEAM = "00000000-0000-0000-0000-00000000000a"
SOURCE_A = "00000000-0000-0000-0000-00000000000b"
SOURCE_B = "00000000-0000-0000-0000-00000000000c"


def _derivation(kind: str = "mean", *metric_ids: str) -> dict[str, Any]:
    return {"kind": kind, "sources": [{"team_id": TEAM, "metric_id": m} for m in metric_ids]}


def test_a_metric_is_added_typed_in_unless_given_a_derivation() -> None:
    assert MetricCreate(**_metric()).derivation is None

    derived = MetricCreate(**_metric(derivation=_derivation("mean", SOURCE_A, SOURCE_B)))

    assert derived.derivation is not None
    assert derived.derivation.kind is DerivationKind.MEAN
    assert [str(s.metric_id) for s in derived.derivation.sources] == [SOURCE_A, SOURCE_B]


@pytest.mark.parametrize("kind", ["mean", "sum", "delta"])
def test_a_derivation_is_one_of_three_kinds(kind: str) -> None:
    change = MetricChange(derivation=_derivation(kind, SOURCE_A))  # type: ignore[arg-type]

    assert change.derivation is not None
    assert change.derivation.kind == kind


def test_a_kind_outside_the_three_is_malformed() -> None:
    assert _published_code(MetricCreate, **_metric(derivation=_derivation("max", SOURCE_A))) == (
        ("derivation", "kind"),
        "request.invalid_field",
    )


def test_a_source_names_its_team_and_its_metric() -> None:
    sources = [{"metric_id": SOURCE_A}]

    assert _published_code(
        MetricCreate, **_metric(derivation={"kind": "mean", "sources": sources})
    ) == (("derivation", "sources", 0, "team_id"), "request.invalid_field")


def test_a_change_leaves_the_derivation_removes_it_or_replaces_it() -> None:
    assert "derivation" not in MetricChange(name="Renamed").model_fields_set
    removed = MetricChange(derivation=None)
    assert ("derivation" in removed.model_fields_set, removed.derivation) == (True, None)
    replaced = MetricChange(derivation=_derivation("sum", SOURCE_A))  # type: ignore[arg-type]
    assert replaced.derivation is not None
    assert replaced.derivation.kind is DerivationKind.SUM


def test_a_copy_and_an_inclusion_take_no_derivation() -> None:
    assert "derivation" not in MetricCopy.model_fields
    assert "derivation" not in GlobalMetricInclusion.model_fields
    assert "derivation" not in GlobalMetricCreate.model_fields


def test_a_derived_value_is_written_as_a_plain_decimal_string() -> None:
    reading = {"meeting_id": SOURCE_A, "date": "2026-10-13", "value": Decimal("391.000000")}
    named = {"id": TEAM, "name": "CKI-P"}
    derived = DerivedValue.model_validate(
        {
            "value": Decimal("-4.000000"),
            "kind": "delta",
            "sources": [
                {
                    **reading,
                    "team": named,
                    "metric": named,
                    "previous": {**reading, "value": Decimal("395")},
                }
            ],
        }
    )

    body = derived.model_dump(mode="json")

    assert (body["value"], body["kind"]) == ("-4", "delta")
    assert (body["sources"][0]["value"], body["sources"][0]["previous"]["value"]) == ("391", "395")


# The scope of a metric on a board


def _definition(**fields: Any) -> dict[str, Any]:
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "team_id": "00000000-0000-0000-0000-000000000002",
        "name": "Revenue",
        "unit": "",
        "decimals": 0,
        "direction": "higher_is_better",
        "group": None,
        "position": 0,
        "owner": None,
        "retired": False,
        "hidden": False,
        "retired_in_catalogue": False,
        **fields,
    }


@pytest.mark.parametrize("scope", ["board", "global"])
def test_a_metric_on_a_board_reads_its_scope(scope: str) -> None:
    read = MetricDefinitionRead.model_validate(_definition(scope=scope))

    assert read.model_dump(mode="json")["scope"] == scope


def test_a_metric_reads_with_no_derivation_unless_it_has_one() -> None:
    assert MetricDefinitionRead.model_validate(_definition(scope="board")).derivation is None

    named = {"id": TEAM, "name": "OTIF-Etap"}
    read = MetricDefinitionRead.model_validate(
        _definition(
            scope="board",
            derivation={"kind": "mean", "sources": [{"team": named, "metric": named}]},
        )
    )

    assert read.model_dump(mode="json")["derivation"] == {
        "kind": "mean",
        "sources": [{"team": named, "metric": named}],
    }


def test_a_scope_is_board_or_global_and_nothing_else() -> None:
    with pytest.raises(ValidationError):
        MetricDefinitionRead.model_validate(_definition(scope="team"))


# Global metrics


def test_a_global_metric_is_validated_like_a_board_metric() -> None:
    metric = GlobalMetricCreate(name="  Availability ", unit=" % ", direction="higher_is_better")

    assert (metric.name, metric.unit, metric.decimals) == ("Availability", "%", 0)
    assert _published_code(GlobalMetricCreate, name=" ", direction="higher_is_better") == (
        ("name",),
        "metric_name.blank",
    )
    assert _published_code(
        GlobalMetricCreate, name="A", unit="x" * 21, direction="higher_is_better"
    ) == (("unit",), "metric_unit.too_long")
    assert _published_code(
        GlobalMetricCreate, name="A", decimals=7, direction="higher_is_better"
    ) == (("decimals",), "metric_decimals.out_of_range")


def test_a_global_metric_has_no_placement_to_set() -> None:
    assert {"group_id", "position"}.isdisjoint(GlobalMetricCreate.model_fields)
    assert "owner_employee_id" not in GlobalMetricChange.model_fields


@pytest.mark.parametrize("field", ["name", "unit", "decimals", "direction", "retired"])
def test_a_global_property_cannot_be_cleared(field: str) -> None:
    assert _published_code(GlobalMetricChange, **{field: None}) == (
        (field,),
        "request.invalid_field",
    )


def test_a_global_metric_reads_its_threshold_and_board_count() -> None:
    read = GlobalMetricRead(
        id="00000000-0000-0000-0000-000000000001",  # type: ignore[arg-type]
        name="Availability",
        unit="%",
        decimals=1,
        direction=Direction.HIGHER_IS_BETTER,
        retired=False,
        threshold=None,
        boards=3,
    )

    assert read.model_dump(mode="json")["scope"] == "global"
    assert set(read.model_dump()) == {
        "id",
        "scope",
        "name",
        "unit",
        "decimals",
        "direction",
        "retired",
        "threshold",
        "boards",
    }


def test_an_inclusion_defaults_its_placement() -> None:
    inclusion = GlobalMetricInclusion(
        global_metric_id="00000000-0000-0000-0000-000000000001",  # type: ignore[arg-type]
    )

    assert (inclusion.group_id, inclusion.owner_employee_id) == (None, None)


# Copy a metric from another board

SOURCE = "00000000-0000-0000-0000-000000000001"


def test_a_copy_keeps_the_source_name_unless_given_one() -> None:
    copy = MetricCopy(source_metric_id=SOURCE)  # type: ignore[arg-type]

    assert (copy.name, copy.group_id) == (None, None)
    assert MetricCopy(source_metric_id=SOURCE, name="  Revenue (Poland) ").name == (  # type: ignore[arg-type]
        "Revenue (Poland)"
    )


@pytest.mark.parametrize(
    ("name", "code"),
    [("   ", "metric_name.blank"), ("x" * 201, "metric_name.too_long")],
)
def test_a_copy_name_is_validated_as_a_metric_name(name: str, code: str) -> None:
    assert _published_code(MetricCopy, source_metric_id=SOURCE, name=name) == (("name",), code)


# Record a threshold version


def _threshold(**fields: Any) -> ThresholdCreate:
    """A version request; the target value 0, which takes boundaries, unless given."""
    return ThresholdCreate(
        **{"effective_from": datetime.date(2026, 10, 1), "reason": "Plan for Q4"},
        **{"target_value": "0", **fields},
    )


def test_a_higher_is_better_version_maps_onto_the_lower_bounds() -> None:
    bounds = _threshold(green="95", amber="85").bounds(Direction.HIGHER_IS_BETTER)

    assert bounds == ThresholdBounds(
        green_lo=Decimal(95), amber_lo=Decimal(85), target_value=Decimal(0)
    )


def test_a_lower_is_better_version_maps_onto_the_upper_bounds() -> None:
    bounds = _threshold(green="5", amber="10").bounds(Direction.LOWER_IS_BETTER)

    assert bounds == ThresholdBounds(
        green_hi=Decimal(5), amber_hi=Decimal(10), target_value=Decimal(0)
    )


def test_a_band_keeps_all_four_bounds() -> None:
    bounds = _threshold(green_lo="71", green_hi="72", amber_lo="70.5", amber_hi="72.5").bounds(
        Direction.WITHIN_BAND
    )

    assert bounds == ThresholdBounds(
        Decimal(71), Decimal(72), Decimal("70.5"), Decimal("72.5"), target_value=Decimal(0)
    )


# A threshold version's target value


@pytest.mark.parametrize("direction", list(Direction))
def test_a_target_value_with_tolerances_stores_no_boundary(direction: Direction) -> None:
    bounds = _threshold(target_value="72.3", green_pct="5", amber_pct="10").bounds(direction)

    assert bounds == ThresholdBounds(
        target_value=Decimal("72.3"), green_pct=Decimal(5), amber_pct=Decimal(10)
    )


def test_the_target_value_is_missing() -> None:
    fields = {"effective_from": "2026-10-01", "reason": "x", "green": "1", "amber": "0"}

    assert _published_code(ThresholdCreate, **fields) == (
        ("target_value",),
        "request.invalid_field",
    )


@pytest.mark.parametrize("field", ["target_value", "green_pct", "amber_pct"])
def test_a_target_value_or_tolerance_too_large_to_store_is_malformed(field: str) -> None:
    fields = {"effective_from": "2026-10-01", "reason": "x", "target_value": "1", field: "1e15"}

    assert _published_code(ThresholdCreate, **fields) == ((field,), "request.invalid_field")


@pytest.mark.parametrize(
    ("fields", "offending"),
    [
        # The target value 0 refuses tolerances...
        ({"target_value": "0", "green_pct": "5", "green": "5", "amber": "10"}, "green_pct"),
        ({"target_value": "0", "amber_pct": "5", "green": "5", "amber": "10"}, "amber_pct"),
        # ...and still needs the direction's boundaries.
        ({"target_value": "0"}, "green"),
        # Any other target value refuses every boundary...
        ({"target_value": "95", "green": "95", "green_pct": "0", "amber_pct": "5"}, "green"),
        ({"target_value": "95", "amber_hi": "99", "green_pct": "0", "amber_pct": "5"}, "amber_hi"),
        # ...and needs both tolerances.
        ({"target_value": "95", "green_pct": "5"}, "amber_pct"),
        ({"target_value": "-20", "amber_pct": "5"}, "green_pct"),
    ],
)
def test_a_version_is_shaped_by_its_target_value(fields: dict[str, str], offending: str) -> None:
    with pytest.raises(ThresholdShapeError) as caught:
        _threshold(**fields).bounds(Direction.LOWER_IS_BETTER)

    assert (caught.value.field, caught.value.code) == (offending, "request.invalid_field")


@pytest.mark.parametrize(
    ("fields", "offending"),
    [
        ({"green_pct": "-1", "amber_pct": "5"}, "green_pct"),
        ({"green_pct": "0", "amber_pct": "-0.000001"}, "amber_pct"),
    ],
)
def test_a_negative_tolerance(fields: dict[str, str], offending: str) -> None:
    with pytest.raises(ThresholdToleranceNegativeError) as caught:
        _threshold(target_value="95", **fields).bounds(Direction.HIGHER_IS_BETTER)

    assert (caught.value.field, caught.value.code) == (offending, "threshold_tolerance.negative")


def test_amber_tighter_than_green() -> None:
    with pytest.raises(ThresholdOrderError):
        _threshold(target_value="95", green_pct="10", amber_pct="5").bounds(
            Direction.HIGHER_IS_BETTER
        )


def test_equal_tolerances_are_accepted() -> None:
    bounds = _threshold(target_value="100", green_pct="0", amber_pct="0").bounds(
        Direction.HIGHER_IS_BETTER
    )

    assert (bounds.green_pct, bounds.amber_pct) == (Decimal(0), Decimal(0))


@pytest.mark.parametrize(
    ("direction", "fields"),
    [
        (Direction.HIGHER_IS_BETTER, {"green": "85", "amber": "95"}),
        (Direction.LOWER_IS_BETTER, {"green": "10", "amber": "5"}),
        (
            Direction.WITHIN_BAND,
            {"green_lo": "71", "green_hi": "72", "amber_lo": "71.5", "amber_hi": "72.5"},
        ),
        (
            Direction.WITHIN_BAND,
            {"green_lo": "71", "green_hi": "72", "amber_lo": "70.5", "amber_hi": "71.5"},
        ),
        (
            Direction.WITHIN_BAND,
            {"green_lo": "72", "green_hi": "71", "amber_lo": "70", "amber_hi": "73"},
        ),
    ],
)
def test_boundaries_in_the_wrong_order(direction: Direction, fields: dict[str, str]) -> None:
    with pytest.raises(ThresholdOrderError):
        _threshold(**fields).bounds(direction)


@pytest.mark.parametrize("direction", [Direction.HIGHER_IS_BETTER, Direction.LOWER_IS_BETTER])
def test_a_plain_red_and_green_metric(direction: Direction) -> None:
    _threshold(green="90", amber="90").bounds(direction)


def test_missing_reason() -> None:
    fields = {
        "effective_from": "2026-10-01",
        "reason": "  ",
        "target_value": "0",
        "green": "1",
        "amber": "0",
    }

    assert _published_code(ThresholdCreate, **fields) == (("reason",), "threshold_reason.blank")


@pytest.mark.parametrize(
    ("direction", "fields", "offending"),
    [
        (Direction.WITHIN_BAND, {"green_lo": "71", "amber_lo": "70"}, "green_hi"),
        (Direction.WITHIN_BAND, {"green": "71", "amber": "70"}, "green"),
        (
            Direction.HIGHER_IS_BETTER,
            {"green": "95", "amber": "85", "green_hi": "99", "amber_hi": "100"},
            "green_hi",
        ),
        (Direction.LOWER_IS_BETTER, {"green": "5"}, "amber"),
    ],
)
def test_boundaries_that_do_not_fit_the_direction(
    direction: Direction, fields: dict[str, str], offending: str
) -> None:
    with pytest.raises(ThresholdShapeError) as caught:
        _threshold(**fields).bounds(direction)

    assert (caught.value.field, caught.value.code) == (offending, "request.invalid_field")


def test_a_boundary_too_large_to_store_is_malformed() -> None:
    fields = {
        "effective_from": "2026-10-01",
        "reason": "x",
        "target_value": "0",
        "green": "1e15",
        "amber": "0",
    }

    assert _published_code(ThresholdCreate, **fields) == (("green",), "request.invalid_field")


def test_bounds_are_written_as_plain_decimal_strings() -> None:
    read = ThresholdRead.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "metric_id": "00000000-0000-0000-0000-000000000002",
            "effective_from": "2026-10-01",
            "target_value": None,
            "green_pct": None,
            "amber_pct": None,
            "green_lo": Decimal("95.300000"),
            "green_hi": None,
            "amber_lo": Decimal("100.000000"),
            "amber_hi": None,
            "reason": "x",
            "recorded_by_email": "a@b.c",
            "recorded_at": "2026-10-01T10:00:00Z",
        }
    )

    body = read.model_dump(mode="json")

    assert (body["green_lo"], body["amber_lo"], body["green_hi"]) == ("95.3", "100", None)


def test_a_read_carries_the_boundaries_a_target_value_amounts_to() -> None:
    row = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000001",
        metric_id="00000000-0000-0000-0000-000000000002",
        effective_from=datetime.date(2026, 10, 1),
        target_value=Decimal("95.000000"),
        green_pct=Decimal("0.000000"),
        amber_pct=Decimal("5.263158"),
        green_lo=None,
        green_hi=None,
        amber_lo=None,
        amber_hi=None,
        reason="x",
        recorded_by_email="a@b.c",
        recorded_at=datetime.datetime(2026, 10, 1, 10, tzinfo=datetime.UTC),
    )

    body = read_threshold(row, Direction.HIGHER_IS_BETTER).model_dump(mode="json")

    assert (body["target_value"], body["green_pct"], body["amber_pct"]) == ("95", "0", "5.263158")
    assert (body["green_lo"], body["amber_lo"]) == ("95", "89.9999999")
    assert (body["green_hi"], body["amber_hi"]) == (None, None)


# Record a metric value at a meeting


def _value(**fields: Any) -> dict[str, Any]:
    return {"value": "96.2", "manual_status": None, "comment": None, **fields}


def test_a_value_is_read_from_a_string_or_a_number_exactly() -> None:
    assert MetricValueWrite(**_value(value="95.3")).value == Decimal("95.3")
    assert MetricValueWrite(**_value(value=95.3)).value == Decimal("95.3")


def test_a_colour_set_by_hand_without_a_comment() -> None:
    for comment in (None, "   "):
        assert _published_code(
            MetricValueWrite, **_value(manual_status="red", comment=comment)
        ) == (("comment",), "metric_value.comment_required")


def test_a_colour_set_by_hand_without_a_number() -> None:
    write = MetricValueWrite(**_value(value=None, manual_status="amber", comment=" Late data "))

    assert (write.value, write.manual_status, write.comment) == (None, Colour.AMBER, "Late data")


@pytest.mark.parametrize("value", ["1000000000000000", "-1e15", "0.0000001"])
def test_a_number_out_of_range(value: str) -> None:
    assert _published_code(MetricValueWrite, **_value(value=value)) == (
        ("value",),
        "metric_value.out_of_range",
    )


@pytest.mark.parametrize("value", ["999999999999999.999999", "0.000001", "174122665"])
def test_a_number_at_the_edge_of_the_range_is_accepted(value: str) -> None:
    assert MetricValueWrite(**_value(value=value)).value == Decimal(value)


def test_the_three_properties_must_all_be_sent() -> None:
    assert _published_code(MetricValueWrite, value="1", manual_status=None) == (
        ("comment",),
        "request.invalid_field",
    )


def test_a_blank_reason_reads_as_none() -> None:
    assert MetricValueWrite(**_value(reason="  ")).reason is None
