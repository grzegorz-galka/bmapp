"""The hub summary.

Partly placeholder data, and the small amount of arithmetic that keeps it
honest. The funnel and the items assigned to the caller are read from the
recorded problems and tasks. The declarations, teams, preparation counts and
in-session flag still belong to capabilities not yet built, so they remain
constants, shaped the way the real capabilities will eventually fill them -
which is why the response still declares itself provisional.

Each team's next meeting is computed rather than written down: it is the next
occurrence of its weekly slot. A hard-coded date would rot within the week
into a countdown running backwards.

The weekly slot is interpreted as UTC. A duration is time-zone independent,
so the countdown is right regardless.
"""

import datetime
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, case, func, literal, select, union_all
from sqlalchemy.orm import Session

from app.core.item_enums import Stage
from app.core.time import ORGANIZATION_TZ
from app.models import Employee, Problem, Task, Team, TeamMember
from app.schemas.hub import (
    AssignedItem,
    BoardReadiness,
    CurrentUser,
    Declarations,
    Funnel,
    FunnelStage,
    FunnelStageCode,
    HubSummary,
    HubTeam,
    ItemKind,
    LocalizedText,
    PreparationCounts,
    ReadinessCode,
    TeamRole,
)
from app.services.item_lifecycle import is_overdue


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


def _identify(email: str) -> CurrentUser:
    """The signed-in person, as the hub shows them.

    Initials are derived from the email rather than stored: there is no name
    on an employee yet, and the header needs something short. "jan.kowalski"
    gives JK, a single-part address gives its first letter.
    """
    local = email.partition("@")[0]
    parts = [part for part in local.replace("_", ".").replace("-", ".").split(".") if part]
    initials = "".join(part[0] for part in parts[:2]).upper() or email[:1].upper()
    return CurrentUser(email=email, initials=initials)


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


def hub_teams(now: datetime.datetime) -> list[HubTeam]:
    """The caller's teams as the hub shows them, soonest next meeting first.

    That is the order the hub displays them in, and the first of them is the
    one the countdown counts down to. Placeholder data still.
    """
    return sorted(
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


#: The order the funnel's stages are shown in.
_FUNNEL_STAGES: tuple[FunnelStageCode, ...] = ("open", "in_progress", "archived")


def _bucket(model: type[Problem] | type[Task]) -> ColumnElement[str]:
    """Which funnel stage an item stands at: archived once closed, open before plan."""
    return case(
        (model.closed_at.is_not(None), literal("archived")),
        (model.stage == Stage.NOT_STARTED, literal("open")),
        else_=literal("in_progress"),
    )


def _funnel(session: Session, email: str) -> Funnel:
    """The items of every team `email` is a member of, counted by kind and stage.

    Two statements whatever the number of teams or items: the scope, and one
    grouped count over both tables.
    """
    my_teams = (
        select(TeamMember.team_id)
        .join(Employee, Employee.id == TeamMember.employee_id)
        .where(Employee.email == email)
    )
    scope = session.scalar(select(func.count()).select_from(my_teams.subquery())) or 0

    def counted(model: type[Problem] | type[Task], kind: ItemKind) -> Select[tuple[ItemKind, str]]:
        return select(literal(kind).label("kind"), _bucket(model).label("bucket")).where(
            model.team_id.in_(my_teams)
        )

    items = union_all(counted(Problem, "problem"), counted(Task, "task")).subquery()
    rows = session.execute(
        select(items.c.kind, items.c.bucket, func.count()).group_by(items.c.kind, items.c.bucket)
    ).all()
    counts = {(kind, bucket): count for kind, bucket, count in rows}

    return Funnel(
        scope_teams=scope,
        stages=[
            FunnelStage(
                stage=stage,
                problems=counts.get(("problem", stage), 0),
                tasks=counts.get(("task", stage), 0),
            )
            for stage in _FUNNEL_STAGES
        ],
    )


def _assigned_items(session: Session, email: str, today: datetime.date) -> list[AssignedItem]:
    """The active items `email` is responsible for, on any team, by due date, none last.

    Not limited to the caller's teams: a person who leaves a team stays
    responsible for its items until someone changes it, and should still see
    them. One statement over both tables.
    """

    def assigned(model: type[Problem] | type[Task], kind: ItemKind) -> Select[Any]:
        return (
            select(
                literal(kind).label("kind"),
                model.id.label("id"),
                model.summary.label("summary"),
                model.team_id.label("team_id"),
                Team.name.label("team"),
                model.stage.label("stage"),
                model.due_on.label("due_on"),
                model.raised_at.label("raised_at"),
            )
            .join(Team, Team.id == model.team_id)
            .join(Employee, Employee.id == model.responsible_employee_id)
            .where(Employee.email == email, model.closed_at.is_(None))
        )

    items = union_all(assigned(Problem, "problem"), assigned(Task, "task")).subquery()
    rows = session.execute(
        select(items).order_by(items.c.due_on.asc().nulls_last(), items.c.raised_at, items.c.id)
    ).all()
    return [
        AssignedItem(
            id=row.id,
            kind=row.kind,
            summary=row.summary,
            team_id=row.team_id,
            team=row.team,
            stage=row.stage,
            due_on=row.due_on,
            overdue=is_overdue(row.due_on, None, today),
        )
        for row in rows
    ]


def build_hub_summary(session: Session, now: datetime.datetime, email: str) -> HubSummary:
    """Assemble the hub summary as of `now`, for the person signed in.

    The identity, the funnel and the assigned items are real; the
    declarations, teams, preparation counts and in-session flag remain
    placeholder data, which is why the response still declares itself
    provisional. A caller with no employee record has no teams and no items,
    so gets zeros and an empty list without a special case.
    """
    return HubSummary(
        current_user=_identify(email),
        declarations=_DECLARATIONS,
        teams=hub_teams(now),
        preparation=_PREPARATION,
        meeting_in_session=_MEETING_IN_SESSION,
        funnel=_funnel(session, email),
        assigned_items=_assigned_items(session, email, now.astimezone(ORGANIZATION_TZ).date()),
    )
