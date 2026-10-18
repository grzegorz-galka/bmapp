"""Response models for the dashboard summary.

Three rules govern this payload, so that the interface can present it in
either language:

* Authored prose published in both languages is a `LocalizedText`, so a
  language change needs no second request. Text a person typed - an
  assigned item's summary, a team's name - is a plain string, returned once
  as typed.
* Anything naming a state from a fixed set is a code the interface
  translates, the same way it translates the codes carried by field errors.
* Every point in time is ISO 8601 - an instant in UTC, a calendar date, or a
  time of day. Nothing formatted for display is returned in its place.
"""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel

from app.core.item_enums import Stage
from app.schemas.meeting import WallClockTime

#: What a team member may be on a team: its leader, one of its leader deputies, or neither.
TeamRole = Literal["leader", "deputy", "member"]

#: Which pictogram a company value is drawn with.
ValueIcon = Literal["effectiveness", "passion", "innovation", "collaboration"]

#: The stages a problem or task passes through.
FunnelStageCode = Literal["open", "in_progress", "archived"]

#: What an item assigned to someone is.
ItemKind = Literal["problem", "task"]


class LocalizedText(BaseModel):
    """Authored prose, carried in every language the interface supports."""

    en: str
    pl: str


class CurrentUser(BaseModel):
    """Who the dashboard is being shown to: the person the token names."""

    email: str
    initials: str


class Value(BaseModel):
    """One of the company's values, by name, with the pictogram it is drawn with."""

    name: LocalizedText
    icon: ValueIcon


class Strategy(BaseModel):
    """The strategic declaration: the horizon it looks to, and what it says."""

    horizon: LocalizedText
    statements: list[LocalizedText]


class GoalGroup(BaseModel):
    """The goals set for one horizon."""

    horizon: LocalizedText
    items: list[LocalizedText]


class Declarations(BaseModel):
    """The company-wide declarations that appear on every board.

    The headings above them are interface labels and live in the catalogues;
    a horizon is part of what is declared, so it travels with the text.
    """

    mission: LocalizedText
    vision: LocalizedText
    values: list[Value]
    strategy: Strategy
    goals: list[GoalGroup]


class DashboardSchedule(BaseModel):
    """When a team meets each week, on the organization's clock."""

    #: ISO weekday, Monday 1 through Sunday 7.
    weekday: int
    start_time: WallClockTime


class DashboardTeam(BaseModel):
    """One team the viewer is a member of."""

    id: uuid.UUID
    name: str
    initials: str
    role: TeamRole
    #: None when the board has no schedule.
    schedule: DashboardSchedule | None
    #: The first opened meeting dated today or later, else the date the
    #: schedule proposes, else None.
    next_meeting_at: datetime.datetime | None


class DashboardMeeting(BaseModel):
    """One current or upcoming board meeting of one of the viewer's teams."""

    team_id: uuid.UUID
    #: The team's name, so the row needs no second request to label it.
    team: str
    #: None while the meeting is only proposed by the schedule, not opened.
    meeting_id: uuid.UUID | None
    #: The wall-clock date and start time on the organization's clock, as the
    #: request opening a proposed meeting takes them back.
    date: datetime.date
    start_time: WallClockTime
    starts_at: datetime.datetime
    #: Decided here, on the organization's calendar, as `overdue` is.
    today: bool
    #: The host's email, if one is named.
    host: str | None
    #: Active metrics with a value at this meeting, and how many there are.
    #: None for a proposed meeting: nothing can be recorded at it yet.
    recorded: int | None
    total: int | None
    #: Whether the viewer has answered this meeting's pulse check.
    pulse_answered: bool
    #: How many current members have answered its pulse check, of how many
    #: members the team has now. None for a proposed meeting.
    pulse_answers: int | None
    members: int | None
    #: How many people still owe data for it, as `owing_by_meeting` counts
    #: them - a count, never names. None for a proposed meeting.
    owing: int | None


class FunnelStage(BaseModel):
    """How many problems and tasks stand at one stage.

    The stage total is the sum of the two and is left to the caller, so the
    three numbers cannot arrive disagreeing with one another.
    """

    stage: FunnelStageCode
    problems: int
    tasks: int


class Funnel(BaseModel):
    """The problem and task funnel, and the scope its figures cover."""

    #: How many teams the figures are counted across: the caller's.
    scope_teams: int
    stages: list[FunnelStage]


class AssignedMetric(BaseModel):
    """The metric an assigned item concerns."""

    id: uuid.UUID
    name: str


class AssignedProblem(BaseModel):
    """The problem an assigned task was raised from."""

    id: uuid.UUID
    summary: str


class AssignedItem(BaseModel):
    """An active problem or task the current user is responsible for."""

    id: uuid.UUID
    kind: ItemKind
    #: As it was typed, in whatever language that was.
    summary: str
    team_id: uuid.UUID
    #: The team's name, so the list needs no second request to label an item.
    team: str
    stage: Stage
    #: None when the item has no due date; such items come last.
    due_on: datetime.date | None
    #: Decided here, on the organization's calendar, as the board's lists are,
    #: so the dashboard and the board never disagree about one item.
    overdue: bool
    metric: AssignedMetric | None
    #: For a task, the problem it was raised from. Always None for a problem.
    problem: AssignedProblem | None


class DashboardSummary(BaseModel):
    """Everything the dashboard displays as data, in one read-only response."""

    current_user: CurrentUser
    declarations: Declarations
    #: Soonest next meeting first; those with none last, by name.
    teams: list[DashboardTeam]
    #: By start, soonest first.
    meetings: list[DashboardMeeting]
    funnel: Funnel
    assigned_items: list[AssignedItem]
