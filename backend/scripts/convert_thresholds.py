"""Give each threshold version recorded before target values a twin that has one.

A version recorded before target values existed keeps its boundaries and no
target value; versions are append-only, so it is never edited. This proposes,
for each such version, a twin with the same effective date, recorded now, so
the twin is the one in force from that date on. The twin's reading comes from:

1. the mapping file, when a row names the metric (and the version's date, or
   no date, meaning every version of the metric);
2. otherwise the default: a one-sided version becomes its green boundary as
   the target value, green 0% and amber |green - amber| / |green|; a green
   boundary of 0 becomes the target value 0 with the same boundaries.

A band, or a default amber tolerance that does not fit the 6 places a version
stores, needs a mapping row; nothing is proposed for it. A version superseded
by one recorded later on the same date judges nothing, and gets no twin.

Every recorded value of a metric that gets a twin is judged under the
versions in force now and after the conversion, and every colour that would
change is listed. Colours set by hand are kept, so they are not listed.

Dry run by default. `--apply` writes every twin in one transaction, and only
when nothing needs a mapping row and every colour change belongs to a mapping
row with `accept_changes` set to yes; otherwise it writes nothing and exits
non-zero.

Run from `backend/` against the database in `BMAPP_DATABASE_URL`:

    uv run python -m scripts.convert_thresholds [--mapping MAPPING.csv] \\
        --actor you@pse.pl [--apply]
"""

import argparse
import csv
import datetime
import io
import sys
import uuid
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, localcontext
from itertools import pairwise
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.metric_enums import Colour, Direction, Status
from app.core.time import ORGANIZATION_TZ
from app.models import Meeting, Metric, MetricThreshold, MetricValue, Team
from app.schemas.metric import fits_a_stored_number
from app.services.metric_status import bounds_of, status_of, threshold_in_force

REASON = "Conversion to target value: {rule}"
RULE_DEFAULT = "the green boundary as the target value"
RULE_ZERO = "the target value 0 with the same range"
RULE_MAPPING = "mapping file"
HUNDRED = Decimal(100)
#: Digits enough for |green - amber| / |green| x 100 to be told exact or not.
_PRECISION = 60

NUMBER_COLUMNS = (
    "target_value",
    "green_pct",
    "amber_pct",
    "green_lo",
    "green_hi",
    "amber_lo",
    "amber_hi",
)
COLUMNS = ("team", "metric", "effective_from", *NUMBER_COLUMNS, "accept_changes")
BOUND_COLUMNS = ("green_lo", "green_hi", "amber_lo", "amber_hi")
#: The boundaries the target value 0 takes, by direction.
RANGE_COLUMNS = {
    Direction.HIGHER_IS_BETTER: ("green_lo", "amber_lo"),
    Direction.LOWER_IS_BETTER: ("green_hi", "amber_hi"),
    Direction.WITHIN_BAND: BOUND_COLUMNS,
}
GLOBAL = "global"


class ConversionError(Exception):
    """The mapping file cannot be used as it is; the lines say why."""

    def __init__(self, problems: Sequence[str]) -> None:
        super().__init__("\n".join(problems))
        self.problems = list(problems)


# ---------------------------------------------------------------- the data


@dataclass(frozen=True, slots=True)
class Threshold:
    """A threshold version, recorded or proposed, as the status rule reads it."""

    effective_from: datetime.date
    recorded_at: datetime.datetime
    target_value: Decimal | None = None
    green_pct: Decimal | None = None
    amber_pct: Decimal | None = None
    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


@dataclass(frozen=True, slots=True)
class Reading:
    """What a twin records: a target value with tolerances, or with boundaries."""

    target_value: Decimal
    green_pct: Decimal | None = None
    amber_pct: Decimal | None = None
    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


@dataclass(frozen=True, slots=True)
class Value:
    """A recorded value, at the date of its meeting, on the team that recorded it."""

    team: str
    meeting_date: datetime.date
    value: Decimal | None
    manual_status: Colour | None


@dataclass(frozen=True, slots=True)
class MetricData:
    """A metric with its versions and every value recorded for it, on any board."""

    id: uuid.UUID
    team: str | None  # None for a global metric
    name: str
    direction: Direction
    versions: tuple[Threshold, ...]
    values: tuple[Value, ...] = ()

    @property
    def label(self) -> str:
        return f"{self.team or GLOBAL} / {self.name}"


@dataclass(frozen=True, slots=True)
class MappingRow:
    """One line of the mapping file."""

    line: int
    team: str | None
    metric: str
    effective_from: datetime.date | None
    target_value: Decimal | None
    green_pct: Decimal | None
    amber_pct: Decimal | None
    green_lo: Decimal | None
    green_hi: Decimal | None
    amber_lo: Decimal | None
    amber_hi: Decimal | None
    accept_changes: bool

    def names(self, metric: MetricData) -> bool:
        """Whether this row is about `metric`, names compared regardless of case."""
        return (self.team or "").lower() == (metric.team or "").lower() and (
            self.metric.lower() == metric.name.lower()
        )

    @property
    def reading(self) -> Reading:
        assert self.target_value is not None  # check_row saw to it
        return Reading(
            self.target_value,
            self.green_pct,
            self.amber_pct,
            self.green_lo,
            self.green_hi,
            self.amber_lo,
            self.amber_hi,
        )


@dataclass(frozen=True, slots=True)
class Proposal:
    """A twin proposed for one version, and where its reading came from."""

    metric: MetricData
    original: Threshold
    twin: Threshold
    rule: str
    row: MappingRow | None = None

    @property
    def reason(self) -> str:
        return REASON.format(rule=self.rule)


@dataclass(frozen=True, slots=True)
class NeedsMapping:
    """A version the default cannot convert, and why."""

    metric: MetricData
    version: Threshold
    why: str


@dataclass(frozen=True, slots=True)
class StatusChange:
    """A value whose colour the conversion would change."""

    metric: MetricData
    value: Value
    before: Status
    after: Status
    accepted: bool


@dataclass(slots=True)
class Plan:
    proposals: list[Proposal] = field(default_factory=list)
    needs_mapping: list[NeedsMapping] = field(default_factory=list)
    changes: list[StatusChange] = field(default_factory=list)
    unused_rows: list[MappingRow] = field(default_factory=list)

    @property
    def refusals(self) -> list[str]:
        """Why `--apply` would write nothing; empty when it may write."""
        refusals = []
        if self.needs_mapping:
            refusals.append(f"{len(self.needs_mapping)} version(s) need a mapping row")
        unaccepted = sum(not change.accepted for change in self.changes)
        if unaccepted:
            refusals.append(
                f"{unaccepted} status change(s) not accepted by a mapping row (accept_changes=yes)"
            )
        return refusals


# ---------------------------------------------------------------- the mapping file


def _cell(raw: dict[str, str | None], column: str) -> str:
    return (raw.get(column) or "").strip()


def parse_mapping(text: str) -> list[MappingRow]:
    """The rows of a mapping file, or every problem with it at once."""
    reader = csv.DictReader(io.StringIO(text))
    header = [name.strip() for name in reader.fieldnames or []]
    missing = [column for column in COLUMNS if column not in header]
    unknown = [column for column in header if column not in COLUMNS]
    problems: list[str] = []
    if missing:
        problems.append(f"the mapping file lacks the column(s) {', '.join(missing)}")
    if unknown:
        problems.append(f"the mapping file has unknown column(s) {', '.join(unknown)}")
    if problems:
        raise ConversionError(problems)
    reader.fieldnames = header

    rows: list[MappingRow] = []
    for raw in reader:
        line = reader.line_num
        if not any(_cell(raw, column) for column in COLUMNS):
            continue
        errors: list[str] = []
        numbers = {column: _number(_cell(raw, column), column, errors) for column in NUMBER_COLUMNS}
        rows.append(
            MappingRow(
                line=line,
                team=_cell(raw, "team") or None,
                metric=_cell(raw, "metric") or _missing("metric", errors),
                effective_from=_date(_cell(raw, "effective_from"), errors),
                accept_changes=_yes_no(_cell(raw, "accept_changes"), errors),
                **numbers,
            )
        )
        problems.extend(f"line {line}: {error}" for error in errors)
    if problems:
        raise ConversionError(problems)
    return rows


def _missing(column: str, errors: list[str]) -> str:
    errors.append(f"{column} is required")
    return ""


def _number(text: str, column: str, errors: list[str]) -> Decimal | None:
    if not text:
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        errors.append(f"{column} {text!r} is not a number (use a dot for decimals)")
        return None
    if not number.is_finite() or not fits_a_stored_number(number):
        errors.append(f"{column} {text} must be under 10^15 with at most 6 decimal places")
        return None
    return number


def _date(text: str, errors: list[str]) -> datetime.date | None:
    if not text:
        return None
    try:
        return datetime.date.fromisoformat(text)
    except ValueError:
        errors.append(f"effective_from {text!r} is not a date (YYYY-MM-DD)")
        return None


def _yes_no(text: str, errors: list[str]) -> bool:
    if text.lower() not in ("yes", "no", ""):
        errors.append(f"accept_changes {text!r} must be yes or no")
    return text.lower() == "yes"


def check_row(row: MappingRow, direction: Direction) -> str | None:
    """Why a row cannot be recorded for a metric of `direction`, or None.

    The rules the API applies to a new version: a target value other than 0
    takes both tolerances, neither below 0 and amber not tighter than green,
    and no boundary; the target value 0 takes the direction's boundaries,
    ordered, and no tolerance.
    """
    if row.target_value is None:
        return "target_value is required"
    tolerances = ("green_pct", "amber_pct")
    if row.target_value != 0:
        given = [column for column in BOUND_COLUMNS if getattr(row, column) is not None]
        if given:
            return f"a target value other than 0 takes tolerances, not {', '.join(given)}"
        if row.green_pct is None or row.amber_pct is None:
            return "a target value other than 0 needs green_pct and amber_pct"
        if row.green_pct < 0 or row.amber_pct < 0:
            return "a tolerance cannot be below 0"
        if row.amber_pct < row.green_pct:
            return "amber_pct cannot be below green_pct"
        return None
    if any(getattr(row, column) is not None for column in tolerances):
        return "the target value 0 takes boundaries, not tolerances"
    wanted = RANGE_COLUMNS[direction]
    stray = [c for c in BOUND_COLUMNS if c not in wanted and getattr(row, c) is not None]
    if stray:
        return f"a {direction.value} metric takes {', '.join(wanted)}, not {', '.join(stray)}"
    absent = [column for column in wanted if getattr(row, column) is None]
    if absent:
        return f"the target value 0 needs {', '.join(absent)} for a {direction.value} metric"
    present = [
        bound
        for bound in (row.amber_lo, row.green_lo, row.green_hi, row.amber_hi)
        if bound is not None
    ]
    if any(low > high for low, high in pairwise(present)):
        return "amber cannot be tighter than green"
    return None


def check_mapping(
    rows: Sequence[MappingRow], metrics: Sequence[MetricData], teams: Iterable[str]
) -> list[str]:
    """Every problem with the rows against the database: names, dates and shapes."""
    known_teams = {team.lower() for team in teams}
    problems: list[str] = []
    seen: dict[tuple[str, str, datetime.date | None], int] = {}
    for row in rows:
        key = ((row.team or "").lower(), row.metric.lower(), row.effective_from)
        if key in seen:
            problems.append(f"line {row.line}: repeats line {seen[key]}")
            continue
        seen[key] = row.line
        if row.team is not None and row.team.lower() not in known_teams:
            problems.append(f"line {row.line}: no team named {row.team!r}")
            continue
        metric = next((m for m in metrics if row.names(m)), None)
        if metric is None:
            where = f"on team {row.team!r}" if row.team else "among the global metrics"
            problems.append(f"line {row.line}: no metric named {row.metric!r} {where}")
            continue
        dates = {version.effective_from for version in metric.versions}
        if row.effective_from is not None and row.effective_from not in dates:
            problems.append(
                f"line {row.line}: {metric.label} has no version from {row.effective_from}"
            )
            continue
        problem = check_row(row, metric.direction)
        if problem is not None:
            problems.append(f"line {row.line}: {problem}")
    return problems


def find_row(
    rows: Sequence[MappingRow], metric: MetricData, effective_from: datetime.date
) -> MappingRow | None:
    """The row for a version: one naming its date, else one naming no date."""
    named = [row for row in rows if row.names(metric)]
    return next((row for row in named if row.effective_from == effective_from), None) or next(
        (row for row in named if row.effective_from is None), None
    )


# ---------------------------------------------------------------- the conversion


def default_reading(direction: Direction, version: Threshold) -> tuple[Reading, str] | str:
    """The default twin of a version and the rule that made it, or why there is none."""
    if direction is Direction.WITHIN_BAND:
        return "a band: a person picks its target value"
    if direction is Direction.HIGHER_IS_BETTER:
        green, amber = version.green_lo, version.amber_lo
    else:
        green, amber = version.green_hi, version.amber_hi
    assert green is not None and amber is not None  # the table's checks see to it
    if green == 0:
        return (
            Reading(
                Decimal(0),
                green_lo=version.green_lo,
                green_hi=version.green_hi,
                amber_lo=version.amber_lo,
                amber_hi=version.amber_hi,
            ),
            RULE_ZERO,
        )
    with localcontext(prec=_PRECISION):
        amber_pct = abs(green - amber) / abs(green) * HUNDRED
    if not fits_a_stored_number(amber_pct):
        return f"amber tolerance {amber_pct:.8f}...% does not fit in 6 decimal places"
    return Reading(green, Decimal(0), amber_pct.normalize()), RULE_DEFAULT


def _candidates(metric: MetricData) -> list[Threshold]:
    """The versions to convert: no target value, and not superseded on their date."""
    return sorted(
        (
            version
            for version in metric.versions
            if version.target_value is None
            and not any(
                other.effective_from == version.effective_from
                and other.recorded_at > version.recorded_at
                for other in metric.versions
            )
        ),
        key=lambda version: (version.effective_from, version.recorded_at),
    )


def _status(
    direction: Direction, value: Value, versions: Iterable[Threshold]
) -> tuple[Status, Threshold | None]:
    version = threshold_in_force(versions, value.meeting_date)
    bounds = bounds_of(direction, version) if version is not None else None
    return status_of(direction, value.value, None, bounds), version


def status_changes(metric: MetricData, proposals: Sequence[Proposal]) -> list[StatusChange]:
    """Every value of the metric whose colour the twins would change.

    A colour set by hand is kept whatever the versions say, so it is skipped.
    A change is accepted when the twin that judges the value after comes from
    a mapping row with `accept_changes` set.
    """
    after_versions = [*metric.versions, *(proposal.twin for proposal in proposals)]
    changes = []
    for value in metric.values:
        if value.manual_status is not None:
            continue
        before, _ = _status(metric.direction, value, metric.versions)
        after, twin = _status(metric.direction, value, after_versions)
        if before != after:
            source = next((p for p in proposals if p.twin is twin), None)
            accepted = bool(source and source.row and source.row.accept_changes)
            changes.append(StatusChange(metric, value, before, after, accepted))
    return changes


def plan(metrics: Sequence[MetricData], rows: Sequence[MappingRow], now: datetime.datetime) -> Plan:
    """What the conversion would record, what it cannot, and what it would change.

    `now` is when the twins are recorded, each a microsecond after the last,
    so every twin is later than every version recorded before the run.
    """
    result = Plan()
    used: set[int] = set()
    for metric in metrics:
        proposals: list[Proposal] = []
        for version in _candidates(metric):
            row = find_row(rows, metric, version.effective_from)
            if row is not None:
                used.add(row.line)
                reading, rule = row.reading, RULE_MAPPING
            else:
                default = default_reading(metric.direction, version)
                if isinstance(default, str):
                    result.needs_mapping.append(NeedsMapping(metric, version, default))
                    continue
                reading, rule = default
            recorded_at = now + datetime.timedelta(microseconds=len(result.proposals))
            twin = Threshold(
                effective_from=version.effective_from,
                recorded_at=recorded_at,
                target_value=reading.target_value,
                green_pct=reading.green_pct,
                amber_pct=reading.amber_pct,
                green_lo=reading.green_lo,
                green_hi=reading.green_hi,
                amber_lo=reading.amber_lo,
                amber_hi=reading.amber_hi,
            )
            proposal = Proposal(metric, version, twin, rule, row)
            proposals.append(proposal)
            result.proposals.append(proposal)
        result.changes.extend(status_changes(metric, proposals))
    result.unused_rows = [row for row in rows if row.line not in used]
    return result


# ---------------------------------------------------------------- the report


def _number_text(number: Decimal) -> str:
    return format(number.normalize(), "f")


def describe(direction: Direction, version: Threshold) -> str:
    """A version as a person reads it: its target value and tolerances, or its boundaries."""
    bounds = bounds_of(direction, version)
    match direction:
        case Direction.HIGHER_IS_BETTER:
            assert bounds.green_lo is not None and bounds.amber_lo is not None
            zones = (
                f"green from {_number_text(bounds.green_lo)}, "
                f"amber from {_number_text(bounds.amber_lo)}"
            )
        case Direction.LOWER_IS_BETTER:
            assert bounds.green_hi is not None and bounds.amber_hi is not None
            zones = (
                f"green up to {_number_text(bounds.green_hi)}, "
                f"amber up to {_number_text(bounds.amber_hi)}"
            )
        case Direction.WITHIN_BAND:
            assert bounds.green_lo is not None and bounds.green_hi is not None
            assert bounds.amber_lo is not None and bounds.amber_hi is not None
            zones = (
                f"green {_number_text(bounds.green_lo)}..{_number_text(bounds.green_hi)}, "
                f"amber {_number_text(bounds.amber_lo)}..{_number_text(bounds.amber_hi)}"
            )
    if version.target_value is None:
        return zones
    if version.green_pct is None or version.amber_pct is None:
        return f"target value {_number_text(version.target_value)}, range: {zones}"
    return (
        f"target value {_number_text(version.target_value)}, "
        f"green {_number_text(version.green_pct)}%, amber {_number_text(version.amber_pct)}% "
        f"({zones})"
    )


def report(result: Plan) -> Iterator[str]:
    """The plan as a person checks it before `--apply`."""
    yield f"Proposed twin versions: {len(result.proposals)}"
    for proposal in result.proposals:
        metric = proposal.metric
        source = f"line {proposal.row.line}" if proposal.row else "default"
        yield f"  {metric.label} ({metric.direction.value}), from {proposal.twin.effective_from}"
        yield f"    was: {describe(metric.direction, proposal.original)}"
        yield f"    now: {describe(metric.direction, proposal.twin)}  [{source}]"
    yield ""
    yield f"Needs a mapping row: {len(result.needs_mapping)}"
    for item in result.needs_mapping:
        yield (
            f"  {item.metric.label}, from {item.version.effective_from}: "
            f"{describe(item.metric.direction, item.version)} - {item.why}"
        )
    yield ""
    yield f"Status changes: {len(result.changes)}"
    for change in result.changes:
        assert change.value.value is not None  # no number, no colour to change
        yield (
            f"  {change.metric.label}, {change.value.team} meeting {change.value.meeting_date}: "
            f"{_number_text(change.value.value)} {change.before.value} -> {change.after.value}"
            f" ({'accepted' if change.accepted else 'NOT accepted'})"
        )
    if result.unused_rows:
        yield ""
        yield f"Mapping rows that matched no version to convert: {len(result.unused_rows)}"
        for row in result.unused_rows:
            yield f"  line {row.line}: {row.team or GLOBAL} / {row.metric}"


# ---------------------------------------------------------------- the database


def read_metrics(session: Session) -> tuple[list[MetricData], list[str]]:
    """Every metric with its versions and values, and every team's name."""
    teams = dict(session.execute(select(Team.id, Team.name)).tuples().all())
    versions: dict[uuid.UUID, list[Threshold]] = {}
    for threshold in session.scalars(select(MetricThreshold)):
        versions.setdefault(threshold.metric_id, []).append(
            Threshold(
                effective_from=threshold.effective_from,
                recorded_at=threshold.recorded_at,
                target_value=threshold.target_value,
                green_pct=threshold.green_pct,
                amber_pct=threshold.amber_pct,
                green_lo=threshold.green_lo,
                green_hi=threshold.green_hi,
                amber_lo=threshold.amber_lo,
                amber_hi=threshold.amber_hi,
            )
        )
    values: dict[uuid.UUID, list[Value]] = {}
    rows = session.execute(
        select(
            MetricValue.metric_id,
            MetricValue.value,
            MetricValue.manual_status,
            Meeting.team_id,
            Meeting.starts_at,
        )
        .join(Meeting, Meeting.id == MetricValue.meeting_id)
        .order_by(Meeting.starts_at)
    )
    for metric_id, value, manual, team_id, starts_at in rows:
        values.setdefault(metric_id, []).append(
            Value(teams[team_id], starts_at.astimezone(ORGANIZATION_TZ).date(), value, manual)
        )
    metrics = [
        MetricData(
            id=metric.id,
            team=teams[metric.team_id] if metric.team_id else None,
            name=metric.name,
            direction=metric.direction,
            versions=tuple(versions.get(metric.id, ())),
            values=tuple(values.get(metric.id, ())),
        )
        for metric in session.scalars(select(Metric).order_by(Metric.team_id, Metric.name))
    ]
    return metrics, list(teams.values())


def write(session: Session, result: Plan, actor_email: str) -> None:
    """Record every twin. Flushes; the caller commits."""
    session.add_all(
        MetricThreshold(
            metric_id=proposal.metric.id,
            effective_from=proposal.twin.effective_from,
            target_value=proposal.twin.target_value,
            green_pct=proposal.twin.green_pct,
            amber_pct=proposal.twin.amber_pct,
            green_lo=proposal.twin.green_lo,
            green_hi=proposal.twin.green_hi,
            amber_lo=proposal.twin.amber_lo,
            amber_hi=proposal.twin.amber_hi,
            reason=proposal.reason,
            recorded_by_email=actor_email,
            recorded_at=proposal.twin.recorded_at,
        )
        for proposal in result.proposals
    )
    session.flush()


def convert(
    session: Session, rows: Sequence[MappingRow], *, actor_email: str, apply: bool
) -> tuple[Plan, bool]:
    """Plan the conversion and, with `apply` and nothing refused, write it.

    Returns the plan and whether it was written. Raises `ConversionError`
    when the mapping does not fit the database. Flushes; the caller commits.
    """
    metrics, teams = read_metrics(session)
    problems = check_mapping(rows, metrics, teams)
    if problems:
        raise ConversionError(problems)
    # The database's clock, the one that stamps every other version.
    now = session.scalar(select(func.clock_timestamp()))
    assert now is not None
    result = plan(metrics, rows, now)
    if apply and not result.refusals:
        write(session, result, actor_email)
        return result, True
    return result, False


# ---------------------------------------------------------------- command line


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--mapping", type=Path, help="the mapping CSV file")
    parser.add_argument("--actor", required=True, help="email recorded as having converted")
    parser.add_argument("--apply", action="store_true", help="write the twins (default: dry run)")
    parser.add_argument("--database-url", help="defaults to BMAPP_DATABASE_URL")
    args = parser.parse_args(argv)

    try:
        rows = parse_mapping(args.mapping.read_text(encoding="utf-8-sig")) if args.mapping else []
        engine = create_engine(args.database_url or get_settings().database_url)
        with Session(engine) as session:
            result, written = convert(
                session, rows, actor_email=args.actor.lower(), apply=args.apply
            )
            for line in report(result):
                print(line)
            print()
            if written:
                session.commit()
                print(f"applied: {len(result.proposals)} version(s) recorded")
                return 0
            session.rollback()
    except ConversionError as error:
        for problem in error.problems:
            print(f"error: {problem}", file=sys.stderr)
        return 2
    if not args.apply:
        verdict = "; --apply would be refused: " + "; ".join(result.refusals)
        print("dry run: nothing written" + (verdict if result.refusals else ""))
        return 0
    print("not applied, nothing written: " + "; ".join(result.refusals), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
