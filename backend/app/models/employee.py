"""Persistence models for employees and their membership of teams."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

#: The longest address SMTP can deliver to (RFC 5321 forward-path limit).
EMAIL_MAX_LENGTH = 254


class Employee(Base):
    """A person, identified by the email the later OIDC login will match on."""

    __tablename__ = "employees"
    __table_args__ = (
        # The schema normalises the email; this is the backstop that keeps a
        # second spelling of the same person out of the table whatever the
        # caller does.
        CheckConstraint("email = lower(btrim(email))", name="ck_employees_email_normalised"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeamMember(Base):
    """An employee's membership of a team, and whether they lead it.

    Leadership is a flag on the membership rather than a column on the team,
    so "the leader is a member" holds by construction.
    """

    __tablename__ = "team_members"
    __table_args__ = (
        # At most one leader per team, enforced by the database. "At least
        # one" is the service's job: registration always inserts a leader and
        # the leader cannot be removed.
        Index(
            "uq_team_members_one_leader",
            "team_id",
            unique=True,
            postgresql_where=text("is_leader"),
        ),
        # For "which teams does this employee belong to"; the primary key
        # already serves lookups by team.
        Index("ix_team_members_employee_id", "employee_id"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True
    )
    # RESTRICT: an employee who still belongs to a team can never vanish.
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), primary_key=True
    )
    is_leader: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    employee: Mapped[Employee] = relationship(lazy="joined")

    @property
    def email(self) -> str:
        return self.employee.email
