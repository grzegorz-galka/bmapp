"""Persistence models for the projects and products a team follows.

Two tables rather than one with a kind: the two differ in what is unique (a
project's code company-wide, a product's name within its team) and in half
their columns, and everything that reads them says "project" or "product"
anyway. Each belongs to exactly one team, which records its metrics.
"""

import datetime
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.employee import Employee

PROJECT_CODE_MAX_LENGTH = 50
PROJECT_NAME_MAX_LENGTH = 200
PRODUCT_NAME_MAX_LENGTH = 200
PRODUCT_JIRA_URL_MAX_LENGTH = 2000


class Project(Base):
    """A project a team follows: a code, a name, a manager and the dates it runs."""

    __tablename__ = "projects"
    __table_args__ = (
        # Company-wide, regardless of case: the code is how people name a
        # project across teams. The index decides a duplicate, so two
        # concurrent additions cannot both pass a read-then-write check.
        Index("uq_projects_code_lower", text("lower(code)"), unique=True),
        # The target of the metrics' composite foreign key, which keeps a
        # metric on a project of its own team.
        UniqueConstraint("id", "team_id", name="uq_projects_id_team"),
        Index("ix_projects_team_id", "team_id"),
        Index("ix_projects_manager_employee_id", "manager_employee_id"),
        CheckConstraint("btrim(code) <> ''", name="ck_projects_code_not_blank"),
        CheckConstraint("btrim(name) <> ''", name="ck_projects_name_not_blank"),
        CheckConstraint("start_date <= end_date", name="ck_projects_dates_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(PROJECT_CODE_MAX_LENGTH), nullable=False)
    name: Mapped[str] = mapped_column(String(PROJECT_NAME_MAX_LENGTH), nullable=False)
    # RESTRICT, as for a metric's owner: a manager keeps resolving to someone.
    manager_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    #: Information only: passing it never changes `active`.
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    #: Set by hand. While false, the project's metrics are retired on the board.
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    manager: Mapped[Employee] = relationship(lazy="joined")


class Product(Base):
    """A product a team looks after: a name, an owner and a link to its Jira board."""

    __tablename__ = "products"
    __table_args__ = (
        # Within the team only: two teams may each look after a "Customer
        # portal". Leading with the team, it also serves the team's list.
        Index("uq_products_team_name_lower", "team_id", text("lower(name)"), unique=True),
        UniqueConstraint("id", "team_id", name="uq_products_id_team"),
        Index("ix_products_owner_employee_id", "owner_employee_id"),
        CheckConstraint("btrim(name) <> ''", name="ck_products_name_not_blank"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(PRODUCT_NAME_MAX_LENGTH), nullable=False)
    owner_employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    #: Only followed, never read from.
    jira_url: Mapped[str | None] = mapped_column(String(PRODUCT_JIRA_URL_MAX_LENGTH), nullable=True)
    #: Set by hand. While false, the product's metrics are retired on the board.
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    owner: Mapped[Employee] = relationship(lazy="joined")
