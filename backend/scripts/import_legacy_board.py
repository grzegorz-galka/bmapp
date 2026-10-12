"""Load a backup of the legacy Boardmeeting tool into BMAPP as one team's board.

The legacy tool is a single HTML file. Its backup (`boardmeeting-backup`, JSON)
holds the data - weeks, problems, tasks, pulse answers - but not what the KPIs
are: their names, formats, directions and tolerances live in the tool's own
configuration, so this reads both files. Nothing about the organization is
written into this module; it all comes from the two files given.

What is loaded, in one transaction:

- every meeting participant as an employee (`firstname.lastname@pse.pl`), all
  members of the team, the tool's meeting owner its leader;
- the team, its board and its weekly schedule;
- one meeting per backup week, at the schedule's time, hosted by that week's
  leader;
- one metric per KPI, and one per organizational unit of a by-unit KPI;
- threshold versions derived from the tool's own colour rule (below);
- every recorded number, its comment, and a colour set by hand where the tool
  had overridden its own rule.

- every problem and task, archived where the tool closed it, at its PDCA
  stage, with the meetings it was raised and closed at, its due date, its
  metric and, for a task, its problem;
- every pulse answer, at its week's meeting.

The KPI projects are counted and skipped: BMAPP has no projects.

A legacy item may name several owners (`Anna Nowak/Jan Kowalski`). BMAPP has
one responsible person, so the first is responsible and the others are named
in the item's text. Owners and pulse respondents become members of the team,
as only members are responsible for items or answer the pulse check.

The colour rule is the legacy `autoStatus`: for G the KPI's fixed `green`, or
else the week's target, a higher-is-better value is green from G and amber
from G - gap; lower-is-better mirrors it; a band is green within lo..hi and
amber within gap of it. That is exactly a BMAPP threshold version, so a new
version starts each week the boundaries change, and statuses come out as the
legacy board showed them.

Run from `backend/` against the database in `BMAPP_DATABASE_URL`:

    uv run python -m scripts.import_legacy_board BACKUP.json TOOL.html \\
        --team "Zarząd" --board "Board Zarządu" --actor you@pse.pl [--replace] [--dry-run]
"""

import argparse
import datetime
import json
import re
import sys
import unicodedata
import uuid
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, field
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.item_enums import Stage
from app.core.metric_enums import Colour, Direction, Status
from app.core.time import ORGANIZATION_TZ
from app.models import (
    BoardDefinition,
    BoardMetric,
    Employee,
    Meeting,
    Metric,
    MetricThreshold,
    MetricValue,
    MetricValueCorrection,
    Problem,
    PulseAnswer,
    Task,
    Team,
    TeamMember,
)
from app.services.metric_status import status_of

EMAIL_DOMAIN = "pse.pl"
SIX_PLACES = Decimal("0.000001")
REASON = "Import z poprzedniej tablicy Boardmeeting ({rule})."
#: Comment for a value whose colour the legacy board set by hand without one;
#: BMAPP requires a comment on a colour set by hand.
HAND_COLOUR_COMMENT = "Kolor ustawiony ręcznie na poprzedniej tablicy (import)."

#: How the tool formats a number, and so the unit BMAPP stores it in. A value
#: is stored as it is shown: a fraction becomes a percentage, zloty millions.
FORMATS: dict[str, tuple[str, int, Decimal]] = {
    "pct": ("%", 1, Decimal(100)),
    "mln": ("mln zł", 1, Decimal("0.000001")),
    "int": ("", 0, Decimal(1)),
    "num": ("", 0, Decimal(1)),
    "num1": ("", 1, Decimal(1)),
}
DIRECTIONS = {
    "up": Direction.HIGHER_IS_BETTER,
    "down": Direction.LOWER_IS_BETTER,
    "band": Direction.WITHIN_BAND,
}
LEGACY_COLOURS = {"g": Colour.GREEN, "y": Colour.AMBER, "r": Colour.RED}
#: The legacy item status, 0 to 4, is the PDCA stage in this order; 4 closes.
STAGES = (Stage.NOT_STARTED, Stage.PLAN, Stage.DO, Stage.CHECK, Stage.ACT)
CO_OWNERS = "Współodpowiedzialni: {names}"
PROBLEM_COMMENT = "Komentarz: {text}"
WEEKDAYS = {
    "poniedziałek": 1,
    "wtorek": 2,
    "środa": 3,
    "czwartek": 4,
    "piątek": 5,
    "sobota": 6,
    "niedziela": 7,
}


class LegacyImportError(Exception):
    """The files cannot be loaded as they are; the message says why."""


# ---------------------------------------------------------------- definitions


@dataclass(frozen=True, slots=True)
class Kpi:
    """One KPI as the legacy tool configures it."""

    id: str
    name: str
    group: str
    fmt: str
    dir: str
    gap: Decimal = Decimal(0)
    green: Decimal | None = None
    lo: Decimal | None = None
    hi: Decimal | None = None
    by_unit: bool = False
    computed: str | None = None

    @property
    def direction(self) -> Direction:
        return DIRECTIONS[self.dir]


@dataclass(frozen=True, slots=True)
class Definitions:
    """What the tool says about the board: its KPIs, units and meeting."""

    kpis: list[Kpi]
    units: list[tuple[str, str]]
    owner: str
    participants: list[str]
    weekday: int
    time: datetime.time


def _js_to_json(literal: str) -> Any:
    """A JavaScript object or array literal of plain data, as Python.

    The tool's configuration quotes every string with double quotes and
    leaves keys bare, so quoting the keys is all JSON needs. A key is a bare
    identifier right after `{` or `,`, which a string in this configuration
    never contains; json.loads refuses anything else rather than guessing.
    """
    quoted = re.sub(r"([{,]\s*)([A-Za-z_]\w*)\s*:", r'\1"\2":', literal)
    try:
        return json.loads(quoted)
    except json.JSONDecodeError as error:
        raise LegacyImportError(f"Cannot read the tool's configuration: {error}") from error


def _balanced(text: str, start: int) -> str:
    """The bracketed literal opening at `start`, skipping brackets in strings."""
    pairs = {"[": "]", "{": "}"}
    stack: list[str] = []
    in_string = False
    for i in range(start, len(text)):
        char = text[i]
        if in_string:
            if char == "\\":
                continue
            if char == '"' and text[i - 1] != "\\":
                in_string = False
        elif char == '"':
            in_string = True
        elif char in pairs:
            stack.append(pairs[char])
        elif char in "]}":
            stack.pop()
            if not stack:
                return text[start : i + 1]
    raise LegacyImportError("The tool's configuration is not closed.")


def _section(text: str, key: str) -> Any:
    match = re.search(rf"\b{key}\s*:\s*([\[{{])", text)
    if match is None:
        raise LegacyImportError(f"The tool has no `{key}` configuration.")
    return _js_to_json(_balanced(text, match.start(1)))


def _decimal(value: object) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def read_definitions(html: str) -> Definitions:
    """The KPIs, units and meeting from the legacy tool's HTML."""
    # The embedded backup is data, not configuration; it holds keys of the
    # same names, so it is cut out before searching.
    html = re.sub(r'<script id="bm-data".*?</script>', "", html, flags=re.S)
    kpis = [
        Kpi(
            id=k["id"],
            name=k["name"],
            group=k["group"],
            fmt=k["fmt"],
            dir=k["dir"],
            gap=_decimal(k.get("gap")) or Decimal(0),
            green=_decimal(k.get("green")),
            lo=_decimal(k.get("lo")),
            hi=_decimal(k.get("hi")),
            by_unit=bool(k.get("byUnit")),
            computed=k.get("computed"),
        )
        for k in _section(html, "kpis")
    ]
    meeting = _section(html, "meeting")
    weekday = next((n for day, n in WEEKDAYS.items() if day in meeting["day"].lower()), None)
    if weekday is None:
        raise LegacyImportError(f"Cannot tell the weekday from {meeting['day']!r}.")
    return Definitions(
        kpis=kpis,
        units=[(u["id"], u["name"]) for u in _section(html, "units")],
        owner=meeting["owner"],
        participants=list(meeting["participants"]),
        weekday=weekday,
        time=datetime.time.fromisoformat(meeting["time"]),
    )


# ---------------------------------------------------------------- pure mapping


def email_of(name: str) -> str:
    """`Grzegorz Gałka` -> `grzegorz.galka@pse.pl`: lower case, ASCII, dotted."""
    # NFKD splits accented letters but has no decomposition for ł.
    folded = unicodedata.normalize("NFKD", name.replace("ł", "l").replace("Ł", "L"))
    ascii_only = "".join(c for c in folded if not unicodedata.combining(c))
    parts = re.split(r"[^A-Za-z0-9]+", ascii_only.lower())
    return ".".join(p for p in parts if p) + f"@{EMAIL_DOMAIN}"


def scaled(kpi: Kpi, number: object) -> Decimal:
    """A legacy number in the unit BMAPP shows it in, to the 6 places it stores."""
    factor = FORMATS[kpi.fmt][2]
    return (Decimal(str(number)) * factor).quantize(SIX_PLACES, rounding=ROUND_HALF_EVEN)


@dataclass(frozen=True, slots=True)
class Bounds:
    """Green and amber boundaries in BMAPP's four columns, already scaled."""

    green_lo: Decimal | None = None
    green_hi: Decimal | None = None
    amber_lo: Decimal | None = None
    amber_hi: Decimal | None = None


def bounds_for(kpi: Kpi, target: object) -> Bounds | None:
    """The legacy `autoStatus` rule as BMAPP boundaries, or None if it has none."""
    if kpi.dir == "band":
        if kpi.lo is None or kpi.hi is None:
            return None
        return Bounds(
            green_lo=scaled(kpi, kpi.lo),
            green_hi=scaled(kpi, kpi.hi),
            amber_lo=scaled(kpi, kpi.lo - kpi.gap),
            amber_hi=scaled(kpi, kpi.hi + kpi.gap),
        )
    g = kpi.green if kpi.green is not None else _decimal(target)
    if g is None:
        return None
    if kpi.dir == "down":
        return Bounds(green_hi=scaled(kpi, g), amber_hi=scaled(kpi, g + kpi.gap))
    return Bounds(green_lo=scaled(kpi, g), amber_lo=scaled(kpi, g - kpi.gap))


@dataclass(frozen=True, slots=True)
class Version:
    effective_from: datetime.date
    bounds: Bounds
    reason: str


def threshold_versions(kpi: Kpi, targets: Sequence[tuple[datetime.date, object]]) -> list[Version]:
    """A version each week the boundaries change, the target carried forward.

    `targets` is every week in date order with that week's target or None;
    the legacy tool reads a missing target as the last one set.
    """
    versions: list[Version] = []
    last: object = None
    for date, target in targets:
        last = target if target is not None else last
        bounds = bounds_for(kpi, last)
        if bounds is not None and (not versions or versions[-1].bounds != bounds):
            rule = (
                f"zielony od {kpi.lo} do {kpi.hi}, tolerancja {kpi.gap}"
                if kpi.dir == "band"
                else f"zielony od {kpi.green if kpi.green is not None else last}, "
                f"tolerancja {kpi.gap}"
            )
            versions.append(Version(date, bounds, REASON.format(rule=rule)))
    return versions


@dataclass(slots=True)
class Entry:
    """What one metric shows at one week, as BMAPP will record it."""

    value: Decimal | None
    comment: str | None
    legacy_colour: Colour | None
    at: datetime.datetime | None


def _instant(milliseconds: object) -> datetime.datetime | None:
    if not isinstance(milliseconds, int | float):
        return None
    return datetime.datetime.fromtimestamp(milliseconds / 1000, tz=datetime.UTC)


def _comment(raw: dict[str, Any]) -> str | None:
    text = raw.get("comment")
    return text.strip() if isinstance(text, str) and text.strip() else None


def entry_of(kpi: Kpi, raw: dict[str, Any], colour_key: str) -> Entry | None:
    """A week's record of a KPI or unit, or None when it holds nothing to load."""
    number = raw.get("value")
    entry = Entry(
        value=scaled(kpi, number) if isinstance(number, int | float) else None,
        comment=_comment(raw),
        legacy_colour=LEGACY_COLOURS.get(raw.get(colour_key, "")),
        at=_instant(raw.get("at")),
    )
    if entry.value is None and entry.comment is None and entry.legacy_colour is None:
        return None
    return entry


def hand_colour(direction: Direction, entry: Entry, threshold: Bounds | None) -> Colour | None:
    """The legacy colour, kept only where the rule would have given another."""
    if entry.legacy_colour is None:
        return None
    computed = status_of(direction, entry.value, None, threshold)
    return None if computed == Status(entry.legacy_colour) else entry.legacy_colour


def unit_average(kpi: Kpi, week: dict[str, Any], units: Iterable[tuple[str, str]]) -> object:
    """The legacy board's value for a by-unit KPI the week did not record itself."""
    values = [
        week[key]["value"]
        for unit_id, _ in units
        if isinstance((week.get(key := f"u_{kpi.id}__{unit_id}") or {}).get("value"), int | float)
    ]
    return sum(values) / len(values) if values else None


def projects_status(projects: Iterable[dict[str, Any]], date: str) -> object:
    """The legacy board's weighted project status (0, 1 or 2 out of 2) on a date."""
    num = den = 0.0
    for project in projects:
        history = project.get("history") or {}
        days = sorted(d for d in history if d <= date)
        if days:
            weight = float(project.get("weight") or 0)
            num += weight * history[days[-1]]
            den += weight
    return num / den / 2 if den else None


def owners_of(raw: dict[str, Any]) -> list[str]:
    """The people a legacy item names as its owners, in the order named."""
    owner = raw.get("owner")
    if not isinstance(owner, str):
        return []
    return [name.strip() for name in re.split(r"[/,;]", owner) if name.strip()]


def stage_of(raw: dict[str, Any]) -> Stage:
    """A legacy item's status as its PDCA stage."""
    status = raw.get("status") or 0
    if not isinstance(status, int) or not 0 <= status < len(STAGES):
        raise LegacyImportError(f"Unknown item status {status!r} for {raw.get('title')!r}.")
    return STAGES[status]


def _text(raw: dict[str, Any], key: str) -> str:
    value = raw.get(key)
    return value.strip() if isinstance(value, str) else ""


def _paragraphs(*texts: str) -> str:
    return "\n\n".join(text for text in texts if text)


def _co_owners(owners: Sequence[str]) -> str:
    return CO_OWNERS.format(names=", ".join(owners[1:])) if len(owners) > 1 else ""


def _date(value: object) -> datetime.date | None:
    return datetime.date.fromisoformat(value) if isinstance(value, str) and value else None


# ---------------------------------------------------------------- loading


@dataclass(slots=True)
class Summary:
    employees_added: int = 0
    members: int = 0
    meetings: int = 0
    metrics: int = 0
    thresholds: int = 0
    values: int = 0
    hand_colours: int = 0
    problems: int = 0
    tasks: int = 0
    archived: int = 0
    pulse_answers: int = 0
    skipped: dict[str, int] = field(default_factory=dict)

    def lines(self) -> Iterator[str]:
        yield f"employees added: {self.employees_added}, team members: {self.members}"
        yield f"meetings: {self.meetings}"
        yield f"metrics: {self.metrics}, threshold versions: {self.thresholds}"
        yield f"values: {self.values} (colours set by hand: {self.hand_colours})"
        yield f"problems: {self.problems}, tasks: {self.tasks} (archived: {self.archived})"
        yield f"pulse answers: {self.pulse_answers}"
        for what, count in self.skipped.items():
            yield f"skipped {what}: {count}"


@dataclass(frozen=True, slots=True)
class _Series:
    """A metric to create, and how to read its weeks out of the backup."""

    kpi: Kpi
    name: str
    key: str
    colour_key: str


def _series(definitions: Definitions) -> list[_Series]:
    series = []
    for kpi in definitions.kpis:
        series.append(_Series(kpi, kpi.name, f"k_{kpi.id}", "status"))
        if kpi.by_unit:
            series.extend(
                _Series(kpi, f"{kpi.name}: {unit_name}", f"u_{kpi.id}__{unit_id}", "color")
                for unit_id, unit_name in definitions.units
            )
    return series


def _employee(session: Session, name: str, summary: Summary) -> Employee:
    email = email_of(name)
    employee = session.scalar(select(Employee).where(Employee.email == email))
    if employee is None:
        employee = Employee(email=email)
        session.add(employee)
        session.flush()
        summary.employees_added += 1
    return employee


def remove_team(session: Session, name: str) -> bool:
    """Delete a team and everything recorded for it, for a clean re-import.

    Values, corrections and pulse answers refer to meetings with RESTRICT, and
    a task to its problem, so they go first; deleting the team then cascades
    to its board and members.
    """
    team = session.scalar(select(Team).where(func.lower(Team.name) == name.lower()))
    if team is None:
        return False
    meetings = select(Meeting.id).where(Meeting.team_id == team.id)
    own_metrics = select(Metric.id).where(Metric.team_id == team.id)
    for model in (MetricValueCorrection, MetricValue, PulseAnswer):
        session.execute(delete(model).where(model.meeting_id.in_(meetings)))
    session.execute(delete(Task).where(Task.team_id == team.id))
    session.execute(delete(Problem).where(Problem.team_id == team.id))
    session.execute(delete(Metric).where(Metric.id.in_(own_metrics)))
    session.execute(delete(Meeting).where(Meeting.team_id == team.id))
    session.delete(team)
    session.flush()
    return True


def load(
    session: Session,
    backup: dict[str, Any],
    definitions: Definitions,
    *,
    team_name: str,
    board_name: str,
    actor_email: str,
) -> Summary:
    """Load the backup as a new team. Flushes; the caller commits or rolls back."""
    if backup.get("format") != "boardmeeting-backup" or backup.get("version") != 1:
        raise LegacyImportError("Not a version 1 boardmeeting-backup file.")
    if session.scalar(select(Team).where(func.lower(Team.name) == team_name.lower())):
        raise LegacyImportError(f"A team named {team_name!r} exists; pass --replace to replace it.")
    collections = backup["collections"]
    weeks: dict[str, dict[str, Any]] = dict(sorted(collections["weeks"].items()))
    summary = Summary()

    problems: dict[str, dict[str, Any]] = collections.get("problems") or {}
    tasks: dict[str, dict[str, Any]] = collections.get("tasks") or {}
    pulse: dict[str, dict[str, Any]] = collections.get("pulse") or {}

    # People: every participant, anyone who hosted a week, owned an item or
    # answered the pulse check.
    names = list(
        dict.fromkeys(
            [
                definitions.owner,
                *definitions.participants,
                *(w["leader"] for w in weeks.values() if w.get("leader")),
                *(n for item in (*problems.values(), *tasks.values()) for n in owners_of(item)),
                *(a["person"] for a in pulse.values() if isinstance(a.get("person"), str)),
            ]
        )
    )
    people = {name: _employee(session, name, summary) for name in names}

    team = Team(name=team_name)
    team.board = BoardDefinition(
        name=board_name,
        schedule_weekday=definitions.weekday,
        schedule_time=definitions.time,
    )
    session.add(team)
    session.flush()
    for name, employee in people.items():
        session.add(
            TeamMember(
                team_id=team.id, employee_id=employee.id, is_leader=name == definitions.owner
            )
        )
    summary.members = len(people)

    meetings: dict[str, Meeting] = {}
    for date, week in weeks.items():
        local = datetime.datetime.combine(
            datetime.date.fromisoformat(date), definitions.time, tzinfo=ORGANIZATION_TZ
        )
        host = people.get(week["leader"]) if week.get("leader") else None
        meeting = Meeting(
            team_id=team.id,
            starts_at=local.astimezone(datetime.UTC),
            host_employee_id=host.id if host else None,
            created_by_email=actor_email,
        )
        session.add(meeting)
        meetings[date] = meeting
    session.flush()
    summary.meetings = len(meetings)

    projects = list((collections.get("projects") or {}).values())
    kpi_metrics: dict[str, uuid.UUID] = {}
    position = 0
    for series in _series(definitions):
        kpi = series.kpi
        if kpi.computed == "pulse":
            # Pulse answers are their own capability; its average is not a
            # number anyone typed in.
            summary.skipped["pulse metric"] = summary.skipped.get("pulse metric", 0) + 1
            continue
        unit, decimals, _ = FORMATS[kpi.fmt]
        position += 10
        metric = Metric(
            team_id=team.id,
            name=series.name,
            unit=unit,
            decimals=decimals,
            direction=kpi.direction,
        )
        session.add(metric)
        session.flush()
        if series.key == f"k_{kpi.id}":
            kpi_metrics[kpi.id] = metric.id
        session.add(
            BoardMetric(
                team_id=team.id, metric_id=metric.id, position=position, group_label=kpi.group
            )
        )
        summary.metrics += 1

        # A unit has no target of its own: the legacy rule judges it against
        # the KPI's fixed green boundary alone.
        is_unit = series.key.startswith("u_")
        targets = [
            (
                datetime.date.fromisoformat(d),
                None if is_unit else (w.get(series.key) or {}).get("target"),
            )
            for d, w in weeks.items()
        ]
        versions = threshold_versions(kpi, targets)
        base = datetime.datetime.now(datetime.UTC)
        for i, version in enumerate(versions):
            session.add(
                MetricThreshold(
                    metric_id=metric.id,
                    effective_from=version.effective_from,
                    reason=version.reason,
                    recorded_by_email=actor_email,
                    recorded_at=base + datetime.timedelta(microseconds=i),
                    **_columns(version.bounds),
                )
            )
        summary.thresholds += len(versions)

        for date, week in weeks.items():
            raw = dict(week.get(series.key) or {})
            # What the legacy board showed when nobody typed the KPI in.
            if not is_unit and not isinstance(raw.get("value"), int | float):
                if kpi.by_unit:
                    raw["value"] = unit_average(kpi, week, definitions.units)
                elif kpi.computed == "projects" and raw:
                    raw["value"] = projects_status(projects, date)
            entry = entry_of(kpi, raw, series.colour_key)
            if entry is None:
                continue
            in_force = _in_force(versions, datetime.date.fromisoformat(date))
            manual = hand_colour(kpi.direction, entry, in_force)
            comment = entry.comment
            if manual is not None:
                summary.hand_colours += 1
                comment = comment or HAND_COLOUR_COMMENT
            if entry.value is None and manual is None and comment is None:
                continue
            session.add(
                MetricValue(
                    metric_id=metric.id,
                    meeting_id=meetings[date].id,
                    value=entry.value,
                    manual_status=manual,
                    comment=comment,
                    recorded_by_email=actor_email,
                    recorded_at=entry.at or meetings[date].starts_at,
                )
            )
            summary.values += 1
    session.flush()

    items = _Items(team.id, people, meetings, kpi_metrics, summary)
    loaded_problems = {key: items.problem(raw) for key, raw in problems.items()}
    session.add_all(loaded_problems.values())
    session.flush()
    session.add_all(items.task(raw, loaded_problems) for raw in tasks.values())
    _load_pulse(session, pulse, people, meetings, summary)
    session.flush()

    if projects:
        summary.skipped["projects"] = len(projects)
    return summary


@dataclass(slots=True)
class _Items:
    """Turns the legacy problems and tasks into BMAPP's, counting as it goes."""

    team_id: uuid.UUID
    people: dict[str, Employee]
    meetings: dict[str, Meeting]
    kpi_metrics: dict[str, uuid.UUID]
    summary: Summary

    def _common(self, raw: dict[str, Any]) -> dict[str, Any]:
        summary = _text(raw, "title")
        if not summary:
            raise LegacyImportError(f"An item has no title: {raw!r}.")
        stage = stage_of(raw)
        owners = owners_of(raw)
        raised = self.meetings.get(raw.get("createdWeek") or "")
        raised_at = (
            _instant(raw.get("createdAt"))
            or (raised.starts_at if raised else None)
            or datetime.datetime.now(datetime.UTC)
        )
        closed = self.meetings.get(raw.get("closedWeek") or "") if stage is Stage.ACT else None
        if stage is Stage.ACT:
            self.summary.archived += 1
        return {
            "team_id": self.team_id,
            "summary": summary,
            "responsible_employee_id": self.people[owners[0]].id if owners else None,
            "due_on": _date(raw.get("due")),
            "metric_id": self.kpi_metrics.get(raw.get("kpi") or ""),
            "stage": stage,
            "raised_at": raised_at,
            "raised_meeting_id": raised.id if raised else None,
            # Closed is the same fact as `act`; a closing week the backup does
            # not hold still closes the item, at the moment it was raised.
            "closed_at": (closed.starts_at if closed else raised_at)
            if stage is Stage.ACT
            else None,
            "closed_meeting_id": closed.id if closed else None,
        }

    def problem(self, raw: dict[str, Any]) -> Problem:
        self.summary.problems += 1
        comment = _text(raw, "comment")
        return Problem(
            **self._common(raw),
            reason=_text(raw, "cause"),
            solution=_paragraphs(
                _text(raw, "idea"),
                PROBLEM_COMMENT.format(text=comment) if comment else "",
                _co_owners(owners_of(raw)),
            ),
        )

    def task(self, raw: dict[str, Any], problems: dict[str, Problem]) -> Task:
        self.summary.tasks += 1
        problem = problems.get(raw.get("problemId") or "")
        return Task(
            **self._common(raw),
            details=_paragraphs(_text(raw, "comment"), _co_owners(owners_of(raw))),
            problem_id=problem.id if problem else None,
        )


def _load_pulse(
    session: Session,
    answers: dict[str, dict[str, Any]],
    people: dict[str, Employee],
    meetings: dict[str, Meeting],
    summary: Summary,
) -> None:
    """Each pulse answer at its week's meeting; one with no meeting, person or rating is skipped."""
    for raw in answers.values():
        meeting = meetings.get(raw.get("week") or "")
        rating = raw.get("mood")
        person = people.get(raw.get("person") or "")
        if meeting is None or person is None or not isinstance(rating, int) or not 1 <= rating <= 5:
            summary.skipped["pulse answers"] = summary.skipped.get("pulse answers", 0) + 1
            continue
        at = _instant(raw.get("at")) or meeting.starts_at
        session.add(
            PulseAnswer(
                meeting_id=meeting.id,
                employee_id=person.id,
                rating=rating,
                positive=_text(raw, "pos"),
                negative=_text(raw, "neg"),
                better=_text(raw, "better"),
                created_at=at,
                updated_at=at,
            )
        )
        summary.pulse_answers += 1


def _columns(bounds: Bounds) -> dict[str, Decimal | None]:
    return {
        "green_lo": bounds.green_lo,
        "green_hi": bounds.green_hi,
        "amber_lo": bounds.amber_lo,
        "amber_hi": bounds.amber_hi,
    }


def _in_force(versions: Sequence[Version], date: datetime.date) -> Bounds | None:
    current = [v for v in versions if v.effective_from <= date]
    return current[-1].bounds if current else None


# ---------------------------------------------------------------- command line


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("backup", type=Path, help="the boardmeeting-backup JSON file")
    parser.add_argument("tool", type=Path, help="the legacy tool's HTML file")
    parser.add_argument("--team", required=True, help="the team's name")
    parser.add_argument("--board", required=True, help="the board's name")
    parser.add_argument("--actor", required=True, help="email recorded as having loaded it")
    parser.add_argument("--replace", action="store_true", help="delete a team of that name first")
    parser.add_argument("--dry-run", action="store_true", help="load, report and roll back")
    parser.add_argument("--database-url", help="defaults to BMAPP_DATABASE_URL")
    args = parser.parse_args(argv)

    backup = json.loads(args.backup.read_text(encoding="utf-8"))
    definitions = read_definitions(args.tool.read_text(encoding="utf-8"))
    engine = create_engine(args.database_url or get_settings().database_url)
    with Session(engine) as session:
        try:
            if args.replace and remove_team(session, args.team):
                print(f"removed the existing team {args.team!r}")
            summary = load(
                session,
                backup,
                definitions,
                team_name=args.team,
                board_name=args.board,
                actor_email=args.actor.lower(),
            )
        except LegacyImportError as error:
            session.rollback()
            print(f"error: {error}", file=sys.stderr)
            return 1
        for line in summary.lines():
            print(line)
        if args.dry_run:
            session.rollback()
            print("dry run: rolled back")
        else:
            session.commit()
            print("committed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
