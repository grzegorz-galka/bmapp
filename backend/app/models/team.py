"""Persistence models for teams and the board definition each one owns."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
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


class BoardDefinition(Base):
    """The single board belonging to a team."""

    __tablename__ = "board_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(TEAM_NAME_MAX_LENGTH), nullable=False)
    # Unique, not merely a foreign key: a team owns exactly one board.
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    team: Mapped[Team] = relationship(back_populates="board")
