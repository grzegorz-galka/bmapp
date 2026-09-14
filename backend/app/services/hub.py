"""The hub summary.

Placeholder data, and the small amount of arithmetic that keeps it honest.
Everything the hub shows belongs to capabilities that are agreed but not yet
built - employees, meetings, metrics, problems, tasks - so until those exist
the figures below are constants, shaped the way the real capabilities will
eventually fill them.

Two things are computed rather than written down. Each team's next meeting is
the next occurrence of its weekly slot, and each assigned item's due date is
an offset from today. Hard-coded dates would rot within the week into a
countdown running backwards, and this page has to stay reviewable for as long
as the rest of BMAPP takes to build.

The weekly slot is interpreted as UTC. An organisation-wide time zone is a
decision the meetings capability should make, not this one; a duration is
time-zone independent either way, so the countdown is right regardless.
"""

import datetime
from dataclasses import dataclass

from app.schemas.hub import (
    AssignedItem,
    BoardReadiness,
    CurrentUser,
    Declarations,
    Funnel,
    FunnelStage,
    HubSummary,
    HubTeam,
    ItemKind,
    LocalizedText,
    PreparationCounts,
    ReadinessCode,
    TeamRole,
)


@dataclass(frozen=True)
class _TeamSeed:
    """A team, with the weekly slot its next meeting is computed from."""

    id: str
    name: str
    initials: str
    role: TeamRole
    #: ISO weekday, Monday 1 through Sunday 7.
    weekday: int
    time_of_day: datetime.time
    readiness: ReadinessCode
    missing_metrics: int | None = None


@dataclass(frozen=True)
class _ItemSeed:
    """An assigned item, with its due date held relative to today.

    The offsets are chosen so that one item is always overdue and the rest are
    not, whenever the summary happens to be requested.
    """

    id: str
    kind: ItemKind
    summary: LocalizedText
    team: str
    progress: int
    due_in_days: int


_CURRENT_USER = CurrentUser(email="g.galka@pse.pl", initials="GG")

_DECLARATIONS = Declarations(
    mission=LocalizedText(
        en=(
            "Keep the systems the company runs on dependable, and make the work "
            "of running them visible to the people who do it."
        ),
        pl=(
            "Utrzymywać systemy, na których pracuje firma, w niezawodnym stanie "
            "— i czynić tę pracę widoczną dla tych, którzy ją wykonują."
        ),
    ),
    vision=LocalizedText(
        en="Every team improving its own numbers, every week, from its own board.",
        pl="Każdy zespół poprawia swoje liczby, co tydzień, przy swojej tablicy.",
    ),
    goals=[
        LocalizedText(
            en="No unplanned downtime on the systems the company runs on.",
            pl="Żadnych nieplanowanych przestojów w systemach, na których pracuje firma.",
        ),
        LocalizedText(
            en="Every change reaches production the week it is agreed.",
            pl="Każda zmiana trafia na produkcję w tygodniu, w którym została ustalona.",
        ),
        LocalizedText(
            en="Each team closes more problems than it raises.",
            pl="Każdy zespół zamyka więcej problemów niż zgłasza.",
        ),
    ],
    values=[
        LocalizedText(en="Go and see", pl="Idź i zobacz"),
        LocalizedText(en="Small steps", pl="Małe kroki"),
        LocalizedText(en="No blame", pl="Bez obwiniania"),
        LocalizedText(en="Make it visible", pl="Pokaż to"),
    ],
)

_TEAMS = (
    _TeamSeed(
        id="platform-core",
        name="Platform Core",
        initials="PC",
        role="leader",
        weekday=4,
        time_of_day=datetime.time(9, 30),
        readiness="ready",
    ),
    _TeamSeed(
        id="payments",
        name="Payments",
        initials="PY",
        role="member",
        weekday=2,
        time_of_day=datetime.time(11, 0),
        readiness="metrics_missing",
        missing_metrics=3,
    ),
    _TeamSeed(
        id="data-plane",
        name="Data Plane",
        initials="DP",
        role="member",
        weekday=3,
        time_of_day=datetime.time(14, 0),
        readiness="ready",
    ),
)

_PREPARATION = PreparationCounts(metrics_due=7, problems_to_review=4, open_tasks=11)

_MEETING_IN_SESSION = True

_FUNNEL = Funnel(
    scope_meetings=12,
    stages=[
        FunnelStage(stage="open", problems=11, tasks=7),
        FunnelStage(stage="in_progress", problems=4, tasks=7),
        FunnelStage(stage="archived", problems=23, tasks=41),
    ],
)

_ITEMS = (
    _ItemSeed(
        id="item-1",
        kind="problem",
        summary=LocalizedText(
            en="Deploy pipeline flaky on release branch",
            pl="Niestabilny pipeline wdrożeniowy na gałęzi release",
        ),
        team="Platform Core",
        progress=60,
        due_in_days=4,
    ),
    _ItemSeed(
        id="item-2",
        kind="task",
        summary=LocalizedText(
            en="Add min/max to “Open bugs” metric",
            pl="Dodać min/maks do wskaźnika „Otwarte błędy”",
        ),
        team="Platform Core",
        progress=25,
        due_in_days=2,
    ),
    _ItemSeed(
        id="item-3",
        kind="problem",
        summary=LocalizedText(
            en="Lead time for payment fixes above 5 days",
            pl="Czas realizacji poprawek płatności powyżej 5 dni",
        ),
        team="Payments",
        progress=10,
        due_in_days=-3,
    ),
    _ItemSeed(
        id="item-4",
        kind="task",
        summary=LocalizedText(
            en="Write up root cause for incident 214",
            pl="Opisać przyczynę źródłową incydentu 214",
        ),
        team="Data Plane",
        progress=80,
        due_in_days=8,
    ),
)


def next_occurrence(
    weekday: int, time_of_day: datetime.time, now: datetime.datetime
) -> datetime.datetime:
    """The next occurrence of a weekly slot, strictly after `now`.

    Strictly, so that a meeting whose time has just arrived reads as next
    week's rather than as one that is already over: a slot falling exactly on
    `now` is the one happening this instant, not the one still to come.
    """
    candidate = datetime.datetime.combine(now.date(), time_of_day, tzinfo=datetime.UTC)
    candidate += datetime.timedelta(days=(weekday - candidate.isoweekday()) % 7)
    if candidate <= now:
        candidate += datetime.timedelta(days=7)
    return candidate


def build_hub_summary(now: datetime.datetime) -> HubSummary:
    """Assemble the hub summary as of `now`.

    Teams come back ordered by their next meeting, soonest first, because that
    is the order the hub displays them in and the first of them is the one the
    countdown counts down to.
    """
    teams = sorted(
        (
            HubTeam(
                id=seed.id,
                name=seed.name,
                initials=seed.initials,
                role=seed.role,
                next_meeting_at=next_occurrence(seed.weekday, seed.time_of_day, now),
                readiness=BoardReadiness(code=seed.readiness, count=seed.missing_metrics),
            )
            for seed in _TEAMS
        ),
        key=lambda team: team.next_meeting_at,
    )

    today = now.date()
    items = [
        AssignedItem(
            id=seed.id,
            kind=seed.kind,
            summary=seed.summary,
            team=seed.team,
            progress=seed.progress,
            due_on=today + datetime.timedelta(days=seed.due_in_days),
        )
        for seed in _ITEMS
    ]

    return HubSummary(
        current_user=_CURRENT_USER,
        declarations=_DECLARATIONS,
        teams=teams,
        preparation=_PREPARATION,
        meeting_in_session=_MEETING_IN_SESSION,
        funnel=_FUNNEL,
        assigned_items=items,
    )
