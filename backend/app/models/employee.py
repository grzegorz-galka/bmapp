"""Persistence models for employees and their membership of teams."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
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

#: The longest address SMTP can deliver to (RFC 5321 forward-path limit).
EMAIL_MAX_LENGTH = 254

#: The longest name or surname stored for an employee.
PERSON_NAME_MAX_LENGTH = 100


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
    # Stored only as the person's own (from the broker's claims, or the dev
    # first-login window); when both are none the display name is derived from
    # the email on reading and never written back, so a guess is never
    # mistaken for a real name.
    name: Mapped[str | None] = mapped_column(String(PERSON_NAME_MAX_LENGTH), nullable=True)
    surname: Mapped[str | None] = mapped_column(String(PERSON_NAME_MAX_LENGTH), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @property
    def display_name(self) -> str:
        """How every response names this person; see `app.services.names`."""
        return person_display_name(self.email, self.name, self.surname)


def person_display_name(email: str, name: str | None, surname: str | None) -> str:
    """`names.display_name`, for the models' properties.

    Imported when called: importing `app.services` runs its package, which
    imports these models, so a module-level import would be circular.
    """
    from app.services.names import display_name

    return display_name(email, name, surname)


class DevCredential(Base):
    """A development-mode account's chosen password, kept only as a salted hash.

    Keyed by email with no foreign key to `employees`, because an administrator
    may sign in with no employee record. Deleting the row is the password
    reset: the derived password then applies again.
    """

    __tablename__ = "dev_credentials"
    __table_args__ = (
        CheckConstraint("email = lower(btrim(email))", name="ck_dev_credentials_email_normalised"),
    )

    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeamMember(Base):
    """An employee's membership of a team, and whether they lead or deputise for it.

    Leadership and deputyship are flags on the membership rather than columns
    on the team, so "the leader is a member" and "a deputy is a member" hold
    by construction.
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
        # The leader stands in for nobody; the service rejects it first with
        # `team_deputy.is_leader`, and this is the backstop.
        CheckConstraint(
            "NOT (is_leader AND is_deputy)", name="ck_team_members_not_leader_and_deputy"
        ),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True
    )
    # RESTRICT: an employee who still belongs to a team can never vanish.
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), primary_key=True
    )
    is_leader: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_deputy: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    employee: Mapped[Employee] = relationship(lazy="joined")

    @property
    def email(self) -> str:
        return self.employee.email

    @property
    def display_name(self) -> str:
        return self.employee.display_name
