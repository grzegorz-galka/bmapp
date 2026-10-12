# The declarations are typeset with the en dashes of the legacy text.
# ruff: noqa: RUF001
"""The dashboard summary.

Everything the landing page shows, read from recorded data in a fixed number
of statements however many teams, meetings and items the viewer has - except
the company declarations, which stay constants until the targets capability
makes them editable.

The dashboard decides no meeting rule of its own. Which meetings still take
values is `editable_meetings`', the date a schedule proposes is
`propose_next`'s, and an overdue item is `is_overdue`'s, so this page and the
board cannot disagree. The recording progress restates the board's
completeness as two grouped counts, because `build_board` costs several
statements per meeting; a test holds the two equal.
"""

import datetime
import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, case, func, literal, null, select, union_all
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session, aliased

from app.core.item_enums import Stage
from app.models import (
    BoardDefinition,
    Employee,
    Meeting,
    Metric,
    MetricValue,
    Problem,
    PulseAnswer,
    Task,
    Team,
    TeamMember,
    WeeklySchedule,
)
from app.models import BoardMetric as Placement
from app.schemas.dashboard import (
    AssignedItem,
    AssignedMetric,
    AssignedProblem,
    CurrentUser,
    DashboardMeeting,
    DashboardSchedule,
    DashboardSummary,
    DashboardTeam,
    Declarations,
    Funnel,
    FunnelStage,
    FunnelStageCode,
    ItemKind,
    LocalizedText,
    Statement,
    Value,
)
from app.services.item_lifecycle import is_overdue
from app.services.meetings import propose_next, to_instant, to_wall_clock
from app.services.metric_values import editable_meetings


def _initials(words: Sequence[str], fallback: str) -> str:
    """The first letters of the first two words, upper-cased."""
    return "".join(word[0] for word in words[:2]).upper() or fallback[:1].upper()


def identify(email: str) -> CurrentUser:
    """The signed-in person, as the dashboard shows them.

    Initials are derived from the email rather than stored: there is no name
    on an employee, and the header needs something short. "jan.kowalski"
    gives JK, a single-part address gives its first letter.
    """
    local = email.partition("@")[0]
    parts = [part for part in local.replace("_", ".").replace("-", ".").split(".") if part]
    return CurrentUser(email=email, initials=_initials(parts, email))


def team_initials(name: str) -> str:
    """A team's badge: the first letters of its first two words, or the first two of one.

    "Platform Core" gives PC, "Payments" gives PA.
    """
    words = name.split()
    if len(words) == 1:
        return words[0][:2].upper()
    return _initials(words, name)


def _text(en: str, pl: str) -> LocalizedText:
    return LocalizedText(en=en, pl=pl)


#: The company's declarations, from the legacy board's *Start* view. Polish is
#: the original without its markup; English is a translation.
DECLARATIONS = Declarations(
    mission=Statement(
        headline=_text(
            "We are here to change the energy sector for the better",
            "Jesteśmy po to, aby zmieniać energetykę na lepsze",
        ),
        body=_text(
            "The energy transition is one of the greatest challenges facing the Polish "
            "economy, and its success depends on the quality of the solutions the system "
            "operator works with. We support PSE in its role as guardian and architect, "
            "delivering solutions and services that genuinely change how the national power "
            "system works. Every project of ours is meant to make the energy sector safer, "
            "more efficient and ready for a zero-emission future.",
            "Transformacja energetyczna to jedno z największych wyzwań polskiej gospodarki, "
            "a jej powodzenie zależy od jakości rozwiązań, którymi posługuje się operator "
            "systemu. Wspieramy PSE w roli strażnika i architekta, dostarczając rozwiązania "
            "i usługi, które realnie zmieniają sposób pracy KSE. Każdy nasz projekt ma czynić "
            "energetykę bezpieczniejszą, sprawniejszą i gotową na bezemisyjną przyszłość.",
        ),
    ),
    vision=Statement(
        headline=_text(
            "We want to create the best solutions in the industry",
            "Chcemy tworzyć najlepsze rozwiązania w branży",
        ),
        body=_text(
            "The best solutions and services are the ones a client recommends to others: "
            "delivered on time, in full, and with a quality confirmed by the satisfaction "
            "of their users. Quality is our point of reference.",
            "Najlepsze rozwiązania i usługi, czyli takie, które klient poleca dalej: "
            "dostarczone na czas, w pełnym zakresie i o jakości potwierdzonej satysfakcją "
            "użytkowników. Punktem odniesienia jest dla nas jakość.",
        ),
    ),
    goals=[
        _text(
            "Growth – PLN 174 million in revenue in 2026 with a headcount of 397",
            "Wzrost – 174 mln zł przychodu w 2026 r. przy zatrudnieniu 397 osób",
        ),
        _text(
            "Adaptability – client NPS: a first measurement with a positive score",
            "Zdolność do adaptacji – NPS klienta: pierwszy pomiar z wynikiem dodatnim",
        ),
        _text(
            "Employee satisfaction – eNPS of 35+ by 2030",
            "Satysfakcja pracowników – eNPS 35+ do 2030 r.",
        ),
    ],
    values=[
        Value(
            name=_text("Effectiveness", "Skuteczność"),
            description=_text(
                "We deliver what we committed to – on time and in full. We answer for "
                "results, not for activity.",
                "Dowozimy to, do czego się zobowiązaliśmy – na czas i w pełnym zakresie. "
                "Rozliczamy się z rezultatów, nie z aktywności.",
            ),
            icon="effectiveness",
        ),
        Value(
            name=_text("Passion", "Pasja"),
            description=_text(
                "For us the energy sector is more than projects – we commit because we "
                "believe in the purpose of the transition. Passion drives a quality no "
                "procedure can enforce.",
                "Energetyka to dla nas coś więcej niż projekty – angażujemy się, bo wierzymy "
                "w sens transformacji. Pasja napędza jakość, której nie da się wymusić "
                "procedurą.",
            ),
            icon="passion",
        ),
        Value(
            name=_text("Innovation", "Innowacyjność"),
            description=_text(
                "We look for better solutions before anyone asks for them – from new "
                "technologies to improvements in everyday work. The courage to experiment "
                "goes hand in hand with responsibility for the result.",
                "Szukamy lepszych rozwiązań, zanim ktoś o nie poprosi – od nowych technologii "
                "po usprawnienia codziennej pracy. Odwaga eksperymentowania idzie u nas "
                "w parze z odpowiedzialnością za wynik.",
            ),
            icon="innovation",
        ),
        Value(
            name=_text("Collaboration", "Współdziałanie"),
            description=_text(
                "The best solutions arise where competences meet – those of our teams, of "
                "PSE and of our partners. We all play for the same goal: we measure success "
                "by the result of the whole, not of its parts.",
                "Najlepsze rozwiązania powstają na styku kompetencji – naszych zespołów, PSE "
                "i partnerów. Gramy do jednej bramki: sukces mierzymy wynikiem całości, "
                "nie części.",
            ),
            icon="collaboration",
        ),
    ],
)


@dataclass(frozen=True, slots=True)
class _Team:
    id: uuid.UUID
    name: str
    is_leader: bool
    schedule: WeeklySchedule | None


@dataclass(frozen=True, slots=True)
class OpenedMeeting:
    """A meeting of one of the viewer's teams, dated today or later."""

    id: uuid.UUID
    team_id: uuid.UUID
    starts_at: datetime.datetime
    host: str | None

    @property
    def date(self) -> datetime.date:
        return to_wall_clock(self.starts_at)[0]


def _teams(session: Session, email: str) -> list[_Team]:
    """The teams `email` is a member of, with the role and the board's schedule. One statement."""
    rows = session.execute(
        select(
            Team.id,
            Team.name,
            TeamMember.is_leader,
            BoardDefinition.schedule_weekday,
            BoardDefinition.schedule_time,
        )
        .select_from(TeamMember)
        .join(Employee, Employee.id == TeamMember.employee_id)
        .join(Team, Team.id == TeamMember.team_id)
        .join(BoardDefinition, BoardDefinition.team_id == Team.id)
        .where(Employee.email == email)
    )
    return [
        _Team(
            id=row.id,
            name=row.name,
            is_leader=row.is_leader,
            schedule=(
                WeeklySchedule(row.schedule_weekday, row.schedule_time)
                if row.schedule_weekday is not None and row.schedule_time is not None
                else None
            ),
        )
        for row in rows
    ]


def _opened(
    session: Session, team_ids: Sequence[uuid.UUID], today: datetime.date
) -> dict[uuid.UUID, list[OpenedMeeting]]:
    """Those teams' meetings dated today or later, with their host, by team. One statement.

    Only these are needed: a meeting before today is never listed, and it can
    neither be the next meeting nor move a proposal dated today or later.
    """
    rows = session.execute(
        select(Meeting.id, Meeting.team_id, Meeting.starts_at, Employee.email)
        .outerjoin(Employee, Employee.id == Meeting.host_employee_id)
        .where(
            Meeting.team_id.in_(team_ids),
            Meeting.starts_at >= to_instant(today, datetime.time.min),
        )
        .order_by(Meeting.starts_at)
    )
    by_team: dict[uuid.UUID, list[OpenedMeeting]] = defaultdict(list)
    for row in rows:
        by_team[row.team_id].append(OpenedMeeting(row.id, row.team_id, row.starts_at, row.email))
    return by_team


def _active_metrics(session: Session, team_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    """How many active metrics each team's board shows, as the board counts them. One statement."""
    rows = session.execute(
        select(Placement.team_id, func.count())
        .join(Metric, Metric.id == Placement.metric_id)
        .where(
            Placement.team_id.in_(team_ids),
            Placement.retired_on_board.is_(False),
            Metric.retired.is_(False),
        )
        .group_by(Placement.team_id)
    )
    return {team_id: count for team_id, count in rows.tuples()}


def _recorded(session: Session, meeting_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    """How many active metrics have a value at each meeting. One statement.

    A value is counted as the board counts it: a row whose number is set, for
    a metric placed on the meeting's team's board and active there.
    """
    rows = session.execute(
        select(MetricValue.meeting_id, func.count())
        .join(Meeting, Meeting.id == MetricValue.meeting_id)
        .join(
            Placement,
            and_(
                Placement.team_id == Meeting.team_id,
                Placement.metric_id == MetricValue.metric_id,
            ),
        )
        .join(Metric, Metric.id == MetricValue.metric_id)
        .where(
            MetricValue.meeting_id.in_(meeting_ids),
            MetricValue.value.is_not(None),
            Placement.retired_on_board.is_(False),
            Metric.retired.is_(False),
        )
        .group_by(MetricValue.meeting_id)
    )
    return {meeting_id: count for meeting_id, count in rows.tuples()}


def _answered(session: Session, email: str, meeting_ids: Sequence[uuid.UUID]) -> set[uuid.UUID]:
    """The meetings among these at which `email` has answered the pulse check. One statement."""
    return set(
        session.scalars(
            select(PulseAnswer.meeting_id)
            .join(Employee, Employee.id == PulseAnswer.employee_id)
            .where(Employee.email == email, PulseAnswer.meeting_id.in_(meeting_ids))
        )
    )


@dataclass(frozen=True, slots=True)
class Upcoming:
    """A team's listed meetings, and the instant of its next one."""

    #: The opened meetings that still take values, dated today or later.
    opened: list[OpenedMeeting]
    #: The schedule's proposal, when no meeting is opened from today on.
    proposed: tuple[datetime.date, datetime.time] | None
    next_meeting_at: datetime.datetime | None


def upcoming(
    opened: Sequence[OpenedMeeting], schedule: WeeklySchedule | None, today: datetime.date
) -> Upcoming:
    """Which of a team's meetings dated today or later are listed, or what is proposed.

    `opened` holds only meetings dated today or later. `editable_meetings`
    applied to them gives exactly the editable meetings dated today or later:
    the latest held meeting is among them only if it is today's.
    """
    dates = {meeting.date for meeting in opened}
    editable = editable_meetings(dates, today)
    listed = [meeting for meeting in opened if meeting.date in editable]
    if listed:
        return Upcoming(listed, None, min(meeting.starts_at for meeting in listed))
    proposed = propose_next(schedule, dates, today)
    return Upcoming([], proposed, to_instant(*proposed) if proposed else None)


def _team_order(team: DashboardTeam) -> tuple[bool, datetime.datetime, str]:
    """Soonest next meeting first; teams with none last, by name."""
    at = team.next_meeting_at
    return (at is None, at or datetime.datetime.min.replace(tzinfo=datetime.UTC), team.name)


def _teams_and_meetings(
    session: Session, email: str, today: datetime.date
) -> tuple[list[DashboardTeam], list[DashboardMeeting]]:
    """The viewer's teams and their board meetings. Five statements."""
    teams = _teams(session, email)
    team_ids = [team.id for team in teams]
    opened = _opened(session, team_ids, today)
    totals = _active_metrics(session, team_ids)
    plans = {team.id: upcoming(opened.get(team.id, []), team.schedule, today) for team in teams}
    meeting_ids = [meeting.id for plan in plans.values() for meeting in plan.opened]
    recorded = _recorded(session, meeting_ids)
    answered = _answered(session, email, meeting_ids)

    dashboard_teams: list[DashboardTeam] = []
    rows: list[DashboardMeeting] = []
    for team in teams:
        plan = plans[team.id]
        schedule = team.schedule
        dashboard_teams.append(
            DashboardTeam(
                id=team.id,
                name=team.name,
                initials=team_initials(team.name),
                role="leader" if team.is_leader else "member",
                schedule=(
                    DashboardSchedule(weekday=schedule.weekday, start_time=schedule.time)
                    if schedule
                    else None
                ),
                next_meeting_at=plan.next_meeting_at,
            )
        )
        for meeting in plan.opened:
            date, start_time = to_wall_clock(meeting.starts_at)
            rows.append(
                DashboardMeeting(
                    team_id=team.id,
                    team=team.name,
                    meeting_id=meeting.id,
                    date=date,
                    start_time=start_time,
                    starts_at=meeting.starts_at.astimezone(datetime.UTC),
                    today=date == today,
                    host=meeting.host,
                    recorded=recorded.get(meeting.id, 0),
                    total=totals.get(team.id, 0),
                    pulse_answered=meeting.id in answered,
                )
            )
        if plan.proposed:
            date, start_time = plan.proposed
            rows.append(
                DashboardMeeting(
                    team_id=team.id,
                    team=team.name,
                    meeting_id=None,
                    date=date,
                    start_time=start_time,
                    starts_at=to_instant(date, start_time),
                    today=date == today,
                    host=None,
                    recorded=None,
                    total=None,
                    pulse_answered=False,
                )
            )
    dashboard_teams.sort(key=_team_order)
    rows.sort(key=lambda row: (row.starts_at, row.team))
    return dashboard_teams, rows


#: The order the funnel's stages are shown in.
_FUNNEL_STAGES: tuple[FunnelStageCode, ...] = ("open", "in_progress", "archived")


def _bucket(model: type[Problem] | type[Task]) -> ColumnElement[str]:
    """Which funnel stage an item stands at: archived once closed, open before plan."""
    return case(
        (model.closed_at.is_not(None), literal("archived")),
        (model.stage == Stage.NOT_STARTED, literal("open")),
        else_=literal("in_progress"),
    )


def _funnel(session: Session, email: str, scope: int) -> Funnel:
    """The items of every team `email` is a member of, counted by kind and stage.

    One grouped count over both tables, whatever the number of teams or items.
    `scope` is the number of those teams, already known to the caller.
    """
    my_teams = (
        select(TeamMember.team_id)
        .join(Employee, Employee.id == TeamMember.employee_id)
        .where(Employee.email == email)
    )

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
    them. One statement over both tables, with the metric and, for a task,
    the problem outer-joined.
    """
    source = aliased(Problem)

    def assigned(model: type[Problem] | type[Task], kind: ItemKind) -> Select[Any]:
        statement = select(
            literal(kind).label("kind"),
            model.id.label("id"),
            model.summary.label("summary"),
            model.team_id.label("team_id"),
            Team.name.label("team"),
            model.stage.label("stage"),
            model.due_on.label("due_on"),
            model.raised_at.label("raised_at"),
            Metric.id.label("metric_id"),
            Metric.name.label("metric_name"),
            (source.id if model is Task else null().cast(UUID(as_uuid=True))).label("problem_id"),
            (source.summary if model is Task else null().cast(Problem.summary.type)).label(
                "problem_summary"
            ),
        )
        statement = (
            statement.select_from(model)
            .join(Team, Team.id == model.team_id)
            .join(Employee, Employee.id == model.responsible_employee_id)
            .outerjoin(Metric, Metric.id == model.metric_id)
        )
        if model is Task:
            statement = statement.outerjoin(source, source.id == Task.problem_id)
        return statement.where(Employee.email == email, model.closed_at.is_(None))

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
            metric=(
                AssignedMetric(id=row.metric_id, name=row.metric_name)
                if row.metric_id is not None
                else None
            ),
            problem=(
                AssignedProblem(id=row.problem_id, summary=row.problem_summary)
                if row.problem_id is not None
                else None
            ),
        )
        for row in rows
    ]


def build_dashboard_summary(session: Session, today: datetime.date, email: str) -> DashboardSummary:
    """Assemble the dashboard summary for the person signed in, as of `today` in Europe/Warsaw.

    Seven statements, whatever the viewer's teams, meetings and items: the
    teams, their meetings from today on, their active metrics, the values at
    the listed meetings, the viewer's pulse answers among them, the funnel,
    and the assigned items. It writes nothing: a proposed meeting is returned,
    not opened. A caller with no employee record has no teams and no items,
    so gets empty lists and zeros without a special case.
    """
    teams, meetings = _teams_and_meetings(session, email, today)
    return DashboardSummary(
        current_user=identify(email),
        declarations=DECLARATIONS,
        teams=teams,
        meetings=meetings,
        funnel=_funnel(session, email, len(teams)),
        assigned_items=_assigned_items(session, email, today),
    )
