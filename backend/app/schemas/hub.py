"""Response models for the hub summary.

Three rules govern this payload, so that the interface can present it in
either language and can be pointed at real data later without changing:

* Authored prose published in both languages is a `LocalizedText`, so a
  language change needs no second request.
* Anything naming a state from a fixed set is a code the interface
  translates, the same way it translates the codes carried by field errors.
* Every point in time is ISO 8601 - an instant in UTC, or a calendar date.
  Nothing formatted for display is returned in its place.

The day and time of the week a team meets is deliberately *not* a field of
its own: it is read off `next_meeting_at`, which is that occurrence. Sending
both would let the two disagree once the reader's time zone is applied.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, Field

#: What a team member may be on a team.
TeamRole = Literal["leader", "member"]

#: Whether a team's board is ready for its next meeting.
ReadinessCode = Literal["ready", "metrics_missing"]

#: The stages a problem or task passes through.
FunnelStageCode = Literal["open", "in_progress", "archived"]

#: What an item assigned to someone is.
ItemKind = Literal["problem", "task"]


class LocalizedText(BaseModel):
    """Authored prose, carried in every language the interface supports."""

    en: str
    pl: str


class CurrentUser(BaseModel):
    """Who the hub is being shown to.

    A placeholder until authentication is built: no session is implied, and
    the interface offers no sign-in or sign-out around it.
    """

    email: str
    initials: str


class Declarations(BaseModel):
    """The company-wide declarations that appear on every board."""

    mission: LocalizedText
    vision: LocalizedText
    goals: list[LocalizedText]
    values: list[LocalizedText]


class BoardReadiness(BaseModel):
    """Whether a board is ready, and if not, how much is missing."""

    code: ReadinessCode
    #: How many metric values are still to be recorded. Absent when ready.
    count: int | None = None


class HubTeam(BaseModel):
    """One team the current user belongs to."""

    id: str
    name: str
    initials: str
    role: TeamRole
    #: The next occurrence of this team's weekly slot, always ahead of the
    #: moment the summary was built.
    next_meeting_at: datetime.datetime
    readiness: BoardReadiness


class PreparationCounts(BaseModel):
    """What is outstanding before the next board meeting."""

    metrics_due: int
    problems_to_review: int
    open_tasks: int


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

    #: How many meetings back the figures reach.
    scope_meetings: int
    stages: list[FunnelStage]


class AssignedItem(BaseModel):
    """A problem or task assigned to the current user."""

    id: str
    kind: ItemKind
    summary: LocalizedText
    team: str
    #: Progress towards done, 0-100.
    progress: int = Field(ge=0, le=100)
    due_on: datetime.date


class HubSummary(BaseModel):
    """Everything the hub displays as data, in one read-only response."""

    #: Always true while the hub is served from placeholder data. It is here
    #: so that no caller mistakes these figures for anything recorded.
    provisional: Literal[True] = True
    current_user: CurrentUser
    declarations: Declarations
    teams: list[HubTeam]
    preparation: PreparationCounts
    meeting_in_session: bool
    funnel: Funnel
    assigned_items: list[AssignedItem]
