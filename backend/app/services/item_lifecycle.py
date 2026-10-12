"""The lifecycle a problem and a task share: their stage, closing, and their meetings.

Pure functions, no I/O and no SQLAlchemy: the problems and tasks services call
them, and the BDD feature states them in plain language against these same
functions. Written once so the two kinds of item cannot drift apart.
"""

import datetime
from collections.abc import Iterable
from typing import Protocol

from app.core.item_enums import Stage


class Dated(Protocol):
    """Anything with a date on the organization's calendar - a meeting, as read."""

    @property
    def date(self) -> datetime.date: ...


def meeting_of_the_moment[M: Dated](meetings: Iterable[M], today: datetime.date) -> M | None:
    """The meeting a change made today belongs to.

    The team's first meeting dated today or later - the one the team will
    next sit at, and where it first sees the change - or, when none is
    opened yet, its latest. None when the team has no meetings. The same
    rule the board page uses to choose the meeting it opens at.
    """
    dated = sorted(meetings, key=lambda meeting: meeting.date)
    coming = [meeting for meeting in dated if meeting.date >= today]
    if coming:
        return coming[0]
    return dated[-1] if dated else None


def apply_stage[M: Dated](
    current_closed_at: datetime.datetime | None,
    new_stage: Stage,
    now: datetime.datetime,
    meeting: M | None,
) -> tuple[datetime.datetime | None, M | None]:
    """When, and at which meeting, an item at `new_stage` was closed.

    Closing sets both to now and the meeting of the moment; any other stage
    leaves the item active, so both are none. An archived item has no next
    stage: the services refuse it before they get here, and this refuses it
    again rather than reopening it silently.
    """
    if current_closed_at is not None:
        raise ValueError("An archived item cannot change its stage.")
    if new_stage is Stage.ACT:
        return now, meeting
    return None, None


def is_overdue(
    due_on: datetime.date | None, closed_at: datetime.datetime | None, today: datetime.date
) -> bool:
    """Whether an active item's due date has passed. Due today is not yet overdue."""
    return due_on is not None and closed_at is None and due_on < today
