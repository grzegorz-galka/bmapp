"""The legacy Boardmeeting import's mapping: pure, no database."""

import datetime
from decimal import Decimal

import pytest

from app.core.metric_enums import Colour, Direction
from scripts.import_legacy_board import (
    Bounds,
    Entry,
    Kpi,
    LegacyImportError,
    bounds_for,
    email_of,
    hand_colour,
    read_definitions,
    scaled,
    threshold_versions,
)
from tests.legacy_board_fixture import TOOL_HTML

UP = Kpi(id="r", name="Revenue", group="F", fmt="mln", dir="up", gap=Decimal(5000000))
DOWN = Kpi(id="b", name="Backlog", group="D", fmt="int", dir="down", gap=Decimal(5))
BAND = Kpi(
    id="e",
    name="Effort",
    group="P",
    fmt="pct",
    dir="band",
    lo=Decimal("0.71"),
    hi=Decimal("0.72"),
    gap=Decimal("0.005"),
)
FIXED = Kpi(
    id="o",
    name="OTIF",
    group="D",
    fmt="pct",
    dir="up",
    green=Decimal("0.95"),
    gap=Decimal("0.25"),
)


@pytest.mark.parametrize(
    ("name", "email"),
    [
        ("Grzegorz Gałka", "grzegorz.galka@pse.pl"),
        ("Magdalena Dudzińska", "magdalena.dudzinska@pse.pl"),
        ("Urszula Małkińska", "urszula.malkinska@pse.pl"),
        ("Zofia Łęcka", "zofia.lecka@pse.pl"),
        ("  Anna   Maria-Nowak ", "anna.maria.nowak@pse.pl"),
    ],
)
def test_an_employee_email_is_made_from_the_name(name: str, email: str) -> None:
    assert email_of(name) == email


def test_a_number_is_stored_in_the_unit_it_is_shown_in() -> None:
    assert scaled(BAND, 0.724) == Decimal("72.4")
    assert scaled(UP, 168997589.049999) == Decimal("168.997589")
    assert scaled(DOWN, 3) == Decimal(3)


def test_higher_is_better_is_green_from_the_target_and_amber_within_the_gap() -> None:
    assert bounds_for(UP, 174000000) == Bounds(green_lo=Decimal(174), amber_lo=Decimal(169))


def test_lower_is_better_mirrors_it() -> None:
    assert bounds_for(DOWN, 0) == Bounds(green_hi=Decimal(0), amber_hi=Decimal(5))


def test_a_band_is_green_within_its_limits_and_amber_within_the_gap() -> None:
    assert bounds_for(BAND, None) == Bounds(
        green_lo=Decimal(71),
        green_hi=Decimal(72),
        amber_lo=Decimal("70.5"),
        amber_hi=Decimal("72.5"),
    )


def test_a_fixed_green_boundary_wins_over_the_target() -> None:
    assert bounds_for(FIXED, 1) == Bounds(green_lo=Decimal(95), amber_lo=Decimal(70))


def test_no_target_means_no_threshold() -> None:
    assert bounds_for(UP, None) is None


def test_a_version_starts_each_week_the_boundaries_change() -> None:
    d = datetime.date.fromisoformat
    versions = threshold_versions(
        UP,
        [
            (d("2026-09-02"), None),
            (d("2026-09-09"), 174000000),
            (d("2026-09-16"), None),  # carried forward, so no new version
            (d("2026-09-23"), 174000000),
            (d("2026-09-30"), 174122665),
        ],
    )

    assert [(v.effective_from, v.bounds.green_lo) for v in versions] == [
        (d("2026-09-09"), Decimal(174)),
        (d("2026-09-30"), Decimal("174.122665")),
    ]
    assert versions[0].reason.startswith("Import z poprzedniej tablicy")


def test_a_legacy_colour_is_kept_only_where_the_rule_disagrees() -> None:
    threshold = Bounds(green_hi=Decimal(0), amber_hi=Decimal(5))

    def entry(colour: Colour) -> Entry:
        return Entry(value=Decimal(3), comment=None, legacy_colour=colour, at=None)

    assert hand_colour(Direction.LOWER_IS_BETTER, entry(Colour.AMBER), threshold) is None
    assert hand_colour(Direction.LOWER_IS_BETTER, entry(Colour.RED), threshold) is Colour.RED


def test_the_tools_configuration_is_read_and_its_embedded_backup_ignored() -> None:
    definitions = read_definitions(TOOL_HTML)

    assert [k.id for k in definitions.kpis] == ["revenue", "backlog", "effort", "otif", "pulse"]
    assert definitions.kpis[1].name == "Backlog: overdue"
    assert definitions.kpis[3].by_unit and definitions.kpis[3].green == Decimal("0.95")
    assert definitions.units == [("north", "North"), ("south", "South")]
    assert (definitions.owner, definitions.weekday, definitions.time) == (
        "Zofia Łęcka",
        3,
        datetime.time(13, 0),
    )


def test_a_tool_without_configuration_is_refused() -> None:
    with pytest.raises(LegacyImportError, match="kpis"):
        read_definitions("<html></html>")
