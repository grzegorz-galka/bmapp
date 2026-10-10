"""Persistence models for teams and the board definition each one owns."""

import uuid
from dataclasses import dataclass
from datetime import datetime, time

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.employee import Employee, TeamMember

TEAM_NAME_MAX_LENGTH = 200


class Team(Base):
    """A team that holds board meetings."""

    __tablename__ = "teams"
    __table_args__ = (
        # Uniqueness is enforced here rather than by a read-then-write check in
        # the service, which would race: two concurrent registrations both read
        # no conflict and both insert.
        Index("ix_teams_name_lower", text("lower(name)"), unique=True),
        CheckConstraint("btrim(name) <> ''", name="ck_teams_name_not_blank"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(TEAM_NAME_MAX_LENGTH), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    board: Mapped[BoardDefinition] = relationship(
        back_populates="team", cascade="all, delete-orphan", lazy="joined"
    )
    members: Mapped[list[TeamMember]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def leader(self) -> Employee:
        """The one member flagged as leader, which every team has."""
        return next(member.employee for member in self.members if member.is_leader)

    @property
    def member_count(self) -> int:
        return len(self.members)


@dataclass(frozen=True, slots=True)
class WeeklySchedule:
    """When a team meets each week: an ISO weekday and a wall-clock time."""

    weekday: int
    time: time


class BoardDefinition(Base):
    """The single board belonging to a team, and when its team meets."""

    __tablename__ = "board_definitions"
    __table_args__ = (
        CheckConstraint(
            "schedule_weekday BETWEEN 1 AND 7", name="ck_board_definitions_schedule_weekday"
        ),
        # A weekday without a time, or the reverse, is not a schedule.
        CheckConstraint(
            "(schedule_weekday IS NULL) = (schedule_time IS NULL)",
            name="ck_board_definitions_schedule_complete",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(TEAM_NAME_MAX_LENGTH), nullable=False)
    # Unique, not merely a foreign key: a team owns exactly one board.
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    #: ISO weekday, Monday 1 through Sunday 7, in the organization's zone.
    schedule_weekday: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    #: Wall-clock start time in the organization's zone, never an instant:
    #: "Wednesdays at 13:00" stays 13:00 across the change of clocks.
    schedule_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    team: Mapped[Team] = relationship(back_populates="board")

    @property
    def schedule(self) -> WeeklySchedule | None:
        """The schedule as one value, or None until one is set.

        The check constraint guarantees both columns are set or neither is.
        """
        if self.schedule_weekday is None or self.schedule_time is None:
            return None
        return WeeklySchedule(self.schedule_weekday, self.schedule_time)
