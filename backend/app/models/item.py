"""Persistence models for a team's problems and tasks.

Two tables of one shape rather than one table with a kind: the columns that
differ - a problem's reason and solution, a task's details and problem - stay
plain columns with no check that depends on the kind. What they share lives
in `_ItemColumns`; the lifecycle they share lives in `item_lifecycle`.
"""

import datetime
import uuid

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.item_enums import Stage
from app.models.employee import Employee
from app.models.meeting import Meeting
from app.models.metric import Metric

ITEM_SUMMARY_MAX_LENGTH = 500
ITEM_TEXT_MAX_LENGTH = 4000


def _stage() -> Enum:
    """A VARCHAR with a check constraint, as a metric's direction is stored."""
    return Enum(
        Stage,
        name="pdca_stage",
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda members: [member.value for member in members],
    )


def _shared_checks(table: str, *text_columns: str) -> tuple[CheckConstraint | Index, ...]:
    """The constraints and indexes both kinds of item carry, named for their table."""
    return (
        # Archived is closed_at; this keeps it the same fact as the stage, so
        # the database cannot hold a closed item at `do` or an open one at `act`.
        CheckConstraint(
            "(stage = 'act') = (closed_at IS NOT NULL)", name=f"ck_{table}_closed_at_act"
        ),
        CheckConstraint("btrim(summary) <> ''", name=f"ck_{table}_summary_not_blank"),
        *(
            CheckConstraint(
                f"char_length({column}) <= {ITEM_TEXT_MAX_LENGTH}",
                name=f"ck_{table}_{column}_length",
            )
            for column in text_columns
        ),
        # The board's two lists: a team's active items, and its archived ones.
        Index(f"ix_{table}_team_closed_at", "team_id", "closed_at"),
        # The dashboard: what is still open and assigned to a person.
        Index(
            f"ix_{table}_responsible_active",
            "responsible_employee_id",
            postgresql_where=text("closed_at IS NULL"),
        ),
    )


class _ItemColumns:
    """The columns a problem and a task share."""

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    summary: Mapped[str] = mapped_column(String(ITEM_SUMMARY_MAX_LENGTH), nullable=False)
    # RESTRICT, as for hosts and owners: a responsible person keeps resolving
    # after leaving the team.
    responsible_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=True
    )
    due_on: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    # SET NULL: a metric can be deleted only while it has no values, which
    # means it was added by mistake, and a link must not hold it in place.
    metric_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metrics.id", ondelete="SET NULL"), nullable=True
    )
    stage: Mapped[Stage] = mapped_column(
        _stage(), nullable=False, default=Stage.NOT_STARTED, server_default=Stage.NOT_STARTED
    )
    raised_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # SET NULL on both meetings: deleting a meeting opened by mistake is not
    # blocked by an item someone raised that week.
    raised_meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True
    )
    closed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    @property
    def archived(self) -> bool:
        return self.closed_at is not None


class Problem(_ItemColumns, Base):
    """An obstacle the team named at a board meeting, its root cause and a way out."""

    __tablename__ = "problems"
    __table_args__ = _shared_checks("problems", "reason", "solution")

    # Not nullable: a blank text is '', so readers never tell NULL from empty.
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    solution: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    responsible: Mapped[Employee | None] = relationship(lazy="joined")
    metric: Mapped[Metric | None] = relationship(lazy="joined")
    raised_meeting: Mapped[Meeting | None] = relationship(
        lazy="joined", foreign_keys="Problem.raised_meeting_id"
    )
    closed_meeting: Mapped[Meeting | None] = relationship(
        lazy="joined", foreign_keys="Problem.closed_meeting_id"
    )


class Task(_ItemColumns, Base):
    """An action the team agreed at a board meeting: who does what by when."""

    __tablename__ = "tasks"
    __table_args__ = _shared_checks("tasks", "details")

    details: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    # RESTRICT: problems are never deleted, so this never fires; it states
    # that rule in the schema too.
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="RESTRICT"), nullable=True
    )

    responsible: Mapped[Employee | None] = relationship(lazy="joined")
    metric: Mapped[Metric | None] = relationship(lazy="joined")
    raised_meeting: Mapped[Meeting | None] = relationship(
        lazy="joined", foreign_keys="Task.raised_meeting_id"
    )
    closed_meeting: Mapped[Meeting | None] = relationship(
        lazy="joined", foreign_keys="Task.closed_meeting_id"
    )
    problem: Mapped[Problem | None] = relationship(lazy="joined")
