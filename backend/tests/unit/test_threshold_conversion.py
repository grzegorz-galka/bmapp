"""The threshold conversion's rules: pure, no database."""

import datetime
import uuid
from decimal import Decimal

import pytest

from app.core.metric_enums import Colour, Direction, Status
from scripts.convert_thresholds import (
    RULE_DEFAULT,
    RULE_MAPPING,
    RULE_ZERO,
    ConversionError,
    MetricData,
    Reading,
    Threshold,
    Value,
    check_mapping,
    default_reading,
    describe,
    parse_mapping,
    plan,
    report,
)

D = Decimal
UP = Direction.HIGHER_IS_BETTER
DOWN = Direction.LOWER_IS_BETTER
BAND = Direction.WITHIN_BAND
EARLIER = datetime.datetime(2026, 10, 1, tzinfo=datetime.UTC)
NOW = datetime.datetime(2026, 11, 1, tzinfo=datetime.UTC)
APRIL = datetime.date(2026, 4, 1)
OCTOBER = datetime.date(2026, 10, 19)
HEADER = (
    "team,metric,effective_from,target_value,green_pct,amber_pct,"
    "green_lo,green_hi,amber_lo,amber_hi,accept_changes\n"
)


def version(
    effective_from: datetime.date = APRIL,
    recorded_at: datetime.datetime = EARLIER,
    **bounds: str,
) -> Threshold:
    return Threshold(effective_from, recorded_at, **{k: D(v) for k, v in bounds.items()})


def value(number: str, on: datetime.date = OCTOBER, manual: Colour | None = None) -> Value:
    return Value("Zarząd", on, D(number), manual)


def metric(
    direction: Direction,
    *versions: Threshold,
    values: tuple[Value, ...] = (),
    team: str | None = "Zarząd",
    name: str = "OTIF",
) -> MetricData:
    return MetricData(uuid.uuid4(), team, name, direction, versions, values)


def mapping(*lines: str) -> str:
    return HEADER + "".join(f"{line}\n" for line in lines)


# ---------------------------------------------------------------- the default rule


def test_a_gap_0_version_is_its_green_boundary_with_no_tolerance() -> None:
    reading = default_reading(UP, version(green_lo="95", amber_lo="95"))

    assert reading == (Reading(D(95), D(0), D(0)), RULE_DEFAULT)


def test_an_exact_amber_tolerance_is_the_gap_as_a_share_of_green() -> None:
    reading = default_reading(DOWN, version(green_hi="40", amber_hi="50"))

    assert reading == (Reading(D(40), D(0), D(25)), RULE_DEFAULT)


def test_a_negative_green_boundary_takes_its_size() -> None:
    reading = default_reading(UP, version(green_lo="-20", amber_lo="-30"))

    assert reading == (Reading(D(-20), D(0), D(50)), RULE_DEFAULT)


def test_a_green_boundary_of_0_is_the_target_value_0_with_the_same_range() -> None:
    reading = default_reading(DOWN, version(green_hi="0", amber_hi="5"))

    assert reading == (Reading(D(0), green_hi=D(0), amber_hi=D(5)), RULE_ZERO)


def test_an_inexact_amber_tolerance_needs_a_mapping_row() -> None:
    # 95 to 90 is 5.263157894...% of 95: no 6 places hold it.
    reading = default_reading(UP, version(green_lo="95", amber_lo="90"))

    assert reading == "amber tolerance 5.26315789...% does not fit in 6 decimal places"


def test_a_band_needs_a_mapping_row() -> None:
    band = version(green_lo="71", green_hi="72", amber_lo="70", amber_hi="73")

    assert default_reading(BAND, band) == "a band: a person picks its target value"


# ---------------------------------------------------------------- planning


def test_a_twin_has_the_same_date_and_is_recorded_now() -> None:
    otif = metric(
        UP, version(green_lo="95", amber_lo="95"), version(OCTOBER, green_lo="96", amber_lo="96")
    )

    result = plan([otif], [], NOW)

    twins = [proposal.twin for proposal in result.proposals]
    assert [(t.effective_from, t.target_value, t.recorded_at) for t in twins] == [
        (APRIL, D(95), NOW),
        (OCTOBER, D(96), NOW + datetime.timedelta(microseconds=1)),
    ]
    assert result.proposals[0].reason == f"Conversion to target value: {RULE_DEFAULT}"
    assert (result.needs_mapping, result.changes, result.refusals) == ([], [], [])


def test_the_default_changes_no_status() -> None:
    values = (value("101"), value("100"), value("92"), value("80"))
    otif = metric(DOWN, version(green_hi="80", amber_hi="100"), values=values)

    result = plan([otif], [], NOW)

    assert len(result.proposals) == 1
    assert result.changes == []


def test_a_version_with_a_target_value_or_superseded_on_its_date_gets_no_twin() -> None:
    later = EARLIER + datetime.timedelta(hours=1)
    otif = metric(
        UP,
        version(green_lo="95", amber_lo="95"),
        # Corrected the same day: only the correction judges anything.
        version(green_lo="96", amber_lo="96", recorded_at=later),
        version(OCTOBER, target_value="100", green_pct="5", amber_pct="10"),
    )

    result = plan([otif], [], NOW)

    assert [p.original.green_lo for p in result.proposals] == [D(96)]


def test_versions_the_default_cannot_convert_are_listed_and_refuse_apply() -> None:
    otif = metric(UP, version(green_lo="95", amber_lo="90"))

    result = plan([otif], [], NOW)

    assert result.proposals == []
    assert [(n.metric.name, n.version.effective_from) for n in result.needs_mapping] == [
        ("OTIF", APRIL)
    ]
    assert result.refusals == ["1 version(s) need a mapping row"]


def test_a_mapping_row_overrides_the_default() -> None:
    otif = metric(
        UP, version(green_lo="95", amber_lo="90"), version(OCTOBER, green_lo="95", amber_lo="95")
    )
    rows = parse_mapping(mapping("Zarząd,otif,2026-04-01,100,5,10,,,,,no"))

    result = plan([otif], rows, NOW)

    [april, october] = result.proposals
    assert (april.twin.target_value, april.twin.green_pct, april.twin.amber_pct) == (
        D(100),
        D(5),
        D(10),
    )
    assert (april.rule, april.row) == (RULE_MAPPING, rows[0])
    # The row names April only; October keeps the default.
    assert (october.rule, october.twin.target_value) == (RULE_DEFAULT, D(95))
    assert result.needs_mapping == []


def test_a_row_without_a_date_covers_every_version_and_a_dated_row_wins() -> None:
    otif = metric(
        UP, version(green_lo="95", amber_lo="90"), version(OCTOBER, green_lo="95", amber_lo="90")
    )
    rows = parse_mapping(
        mapping(
            "Zarząd,OTIF,,100,5,10,,,,,no",
            "Zarząd,OTIF,2026-10-19,95,0,10,,,,,no",
        )
    )

    result = plan([otif], rows, NOW)

    assert [p.twin.target_value for p in result.proposals] == [D(100), D(95)]


def test_a_status_change_is_refused_without_accept_changes() -> None:
    # 92 is amber against "green from 95, amber from 90", red against 100 -5% -6%.
    otif = metric(UP, version(green_lo="95", amber_lo="90"), values=(value("92"), value("97")))
    rows = parse_mapping(mapping("Zarząd,OTIF,,100,5,6,,,,,no"))

    result = plan([otif], rows, NOW)

    [change] = result.changes
    assert (change.value.value, change.before, change.after, change.accepted) == (
        D(92),
        Status.AMBER,
        Status.RED,
        False,
    )
    assert result.refusals == [
        "1 status change(s) not accepted by a mapping row (accept_changes=yes)"
    ]


def test_a_status_change_accepted_by_its_row_lets_apply_write() -> None:
    otif = metric(UP, version(green_lo="95", amber_lo="90"), values=(value("92"),))
    rows = parse_mapping(mapping("Zarząd,OTIF,,100,5,6,,,,,yes"))

    result = plan([otif], rows, NOW)

    assert [change.accepted for change in result.changes] == [True]
    assert result.refusals == []


def test_a_colour_set_by_hand_is_not_a_status_change() -> None:
    held = value("92", manual=Colour.GREEN)
    otif = metric(UP, version(green_lo="95", amber_lo="90"), values=(held,))
    rows = parse_mapping(mapping("Zarząd,OTIF,,100,5,6,,,,,no"))

    assert plan([otif], rows, NOW).changes == []


def test_a_value_before_the_first_version_keeps_no_threshold() -> None:
    early = value("92", on=datetime.date(2026, 3, 1))
    otif = metric(UP, version(green_lo="95", amber_lo="90"), values=(early,))
    rows = parse_mapping(mapping("Zarząd,OTIF,,100,5,6,,,,,no"))

    assert plan([otif], rows, NOW).changes == []


def test_a_global_metric_is_named_with_no_team() -> None:
    nps = metric(UP, version(green_lo="30", amber_lo="10"), team=None, name="NPS")
    rows = parse_mapping(mapping(",nps,,30,0,70,,,,,no"))

    result = plan([nps], rows, NOW)

    assert [p.metric.label for p in result.proposals] == ["global / NPS"]
    assert result.unused_rows == []


def test_a_row_that_matched_nothing_is_reported() -> None:
    otif = metric(UP, version(green_lo="95", amber_lo="95"))
    rows = parse_mapping(mapping("Zarząd,Other,,100,5,6,,,,,no"))

    assert [row.metric for row in plan([otif], rows, NOW).unused_rows] == ["Other"]


# ---------------------------------------------------------------- the mapping file


def test_a_mapping_file_is_read() -> None:
    [row] = parse_mapping(mapping(" Zarząd , Aneksy ,2026-10-19,0,,,,5,,10,YES"))

    assert (row.line, row.team, row.metric, row.effective_from) == (2, "Zarząd", "Aneksy", OCTOBER)
    assert (row.target_value, row.green_hi, row.amber_hi, row.accept_changes) == (
        D(0),
        D(5),
        D(10),
        True,
    )


def test_blank_lines_are_skipped() -> None:
    assert parse_mapping(mapping(",,,,,,,,,,", "Zarząd,OTIF,,100,5,6,,,,,")) != []


def test_a_mapping_file_with_wrong_columns_is_refused() -> None:
    with pytest.raises(ConversionError) as error:
        parse_mapping("team,metric,target\n")

    assert error.value.problems[0].startswith("the mapping file lacks the column(s) effective_from")
    assert error.value.problems[1] == "the mapping file has unknown column(s) target"


def test_unreadable_cells_are_refused_with_their_line() -> None:
    with pytest.raises(ConversionError) as error:
        parse_mapping(
            mapping(
                "Zarząd,,19.10.2026,72,3,,1.2345678,,,,maybe",
                "Zarząd,OTIF,,7x,,,,,,,",
            )
        )

    assert error.value.problems == [
        "line 2: green_lo 1.2345678 must be under 10^15 with at most 6 decimal places",
        "line 2: metric is required",
        "line 2: effective_from '19.10.2026' is not a date (YYYY-MM-DD)",
        "line 2: accept_changes 'maybe' must be yes or no",
        "line 3: target_value '7x' is not a number (use a dot for decimals)",
    ]


def _problems(*lines: str, direction: Direction = UP) -> list[str]:
    metrics = [
        metric(direction, _version_for(direction)),
        metric(UP, version(green_lo="30", amber_lo="10"), team=None, name="NPS"),
    ]
    return check_mapping(parse_mapping(mapping(*lines)), metrics, ["Zarząd", "CKI-P"])


def _version_for(direction: Direction) -> Threshold:
    match direction:
        case Direction.HIGHER_IS_BETTER:
            return version(green_lo="95", amber_lo="90")
        case Direction.LOWER_IS_BETTER:
            return version(green_hi="5", amber_hi="10")
        case Direction.WITHIN_BAND:
            return version(green_lo="71", green_hi="72", amber_lo="70", amber_hi="73")


def test_rows_naming_what_does_not_exist_are_refused() -> None:
    assert _problems(
        "Nobody,OTIF,,100,5,6,,,,,",
        "CKI-P,OTIF,,100,5,6,,,,,",
        ",OTIF,,100,5,6,,,,,",
        "Zarząd,OTIF,2026-05-01,100,5,6,,,,,",
        "Zarząd,OTIF,,100,5,6,,,,,",
        "zarząd,otif,,100,5,6,,,,,",
    ) == [
        "line 2: no team named 'Nobody'",
        "line 3: no metric named 'OTIF' on team 'CKI-P'",
        "line 4: no metric named 'OTIF' among the global metrics",
        "line 5: Zarząd / OTIF has no version from 2026-05-01",
        "line 7: repeats line 6",
    ]


@pytest.mark.parametrize(
    ("line", "direction", "problem"),
    [
        ("100,5,6,95,,,,", UP, "a target value other than 0 takes tolerances, not green_lo"),
        ("100,5,,,,,,", UP, "a target value other than 0 needs green_pct and amber_pct"),
        ("100,-1,6,,,,,", UP, "a tolerance cannot be below 0"),
        ("100,6,5,,,,,", UP, "amber_pct cannot be below green_pct"),
        (",5,6,,,,,", UP, "target_value is required"),
        ("0,5,,,,,,", UP, "the target value 0 takes boundaries, not tolerances"),
        (
            "0,,,,5,,10",
            UP,
            "a higher_is_better metric takes green_lo, amber_lo, not green_hi, amber_hi",
        ),
        ("0,,,95,,,", UP, "the target value 0 needs amber_lo for a higher_is_better metric"),
        ("0,,,90,,95,", UP, "amber cannot be tighter than green"),
        ("0,,,,10,,5", DOWN, "amber cannot be tighter than green"),
        (
            "0,,,71,72,70,",
            BAND,
            "the target value 0 needs amber_hi for a within_band metric",
        ),
    ],
)
def test_rows_the_api_would_refuse_are_refused(
    line: str, direction: Direction, problem: str
) -> None:
    assert _problems(f"Zarząd,OTIF,,{line},", direction=direction) == [f"line 2: {problem}"]


@pytest.mark.parametrize(
    ("line", "direction"),
    [
        ("100,0,0,,,,", UP),
        ("0,,,95,,90,", UP),
        ("0,,,,5,,10", DOWN),
        ("0,,,71,72,70,73", BAND),
    ],
)
def test_rows_the_api_would_accept_are_accepted(line: str, direction: Direction) -> None:
    assert _problems(f"Zarząd,OTIF,,{line},", direction=direction) == []


# ---------------------------------------------------------------- the report


def test_a_version_reads_as_its_target_value_or_its_boundaries() -> None:
    assert describe(UP, version(green_lo="95", amber_lo="90")) == "green from 95, amber from 90"
    assert (
        describe(UP, version(target_value="100", green_pct="5", amber_pct="10"))
        == "target value 100, green 5%, amber 10% (green from 95, amber from 90)"
    )
    assert (
        describe(DOWN, version(target_value="0", green_hi="5", amber_hi="10"))
        == "target value 0, range: green up to 5, amber up to 10"
    )
    assert (
        describe(BAND, version(green_lo="71", green_hi="72", amber_lo="70.5", amber_hi="72.5"))
        == "green 71..72, amber 70.5..72.5"
    )


def test_the_report_lists_twins_what_needs_a_row_and_status_changes() -> None:
    otif = metric(UP, version(green_lo="95", amber_lo="90"), values=(value("92"),))
    effort = metric(
        BAND,
        version(green_lo="71", green_hi="72", amber_lo="70", amber_hi="73"),
        name="Effort",
    )
    rows = parse_mapping(mapping("Zarząd,OTIF,,100,5,6,,,,,no", "Zarząd,Gone,,1,0,0,,,,,no"))

    lines = list(report(plan([otif, effort], rows, NOW)))

    assert lines == [
        "Proposed twin versions: 1",
        "  Zarząd / OTIF (higher_is_better), from 2026-04-01",
        "    was: green from 95, amber from 90",
        "    now: target value 100, green 5%, amber 6% (green from 95, amber from 94)  [line 2]",
        "",
        "Needs a mapping row: 1",
        "  Zarząd / Effort, from 2026-04-01: green 71..72, amber 70..73"
        " - a band: a person picks its target value",
        "",
        "Status changes: 1",
        "  Zarząd / OTIF, Zarząd meeting 2026-10-19: 92 amber -> red (NOT accepted)",
        "",
        "Mapping rows that matched no version to convert: 1",
        "  line 3: Zarząd / Gone",
    ]
