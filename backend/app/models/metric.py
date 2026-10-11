"""Persistence models for a board's metrics, their thresholds and their values."""

import datetime
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.metric_enums import Colour, Direction
from app.models.employee import EMAIL_MAX_LENGTH, Employee

METRIC_NAME_MAX_LENGTH = 200
METRIC_UNIT_MAX_LENGTH = 20
METRIC_GROUP_MAX_LENGTH = 200
METRIC_DECIMALS_MAX = 6

#: Exact decimals, 15 integer digits and 6 places: enough for 174122665 and
#: for 0.71, and never a binary float near a boundary.
NUMBER_PRECISION = 21
NUMBER_SCALE = 6


def _number() -> Numeric[Decimal]:
    return Numeric(NUMBER_PRECISION, NUMBER_SCALE)


def _enum(enum: type[Direction] | type[Colour], name: str) -> Enum:
    """A VARCHAR with a check constraint, storing the enum's lower-case value.

    Not a native PostgreSQL enum: adding a value to one is a migration that
    cannot run inside a transaction.
    """
    return Enum(
        enum,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda members: [member.value for member in members],
    )


class Metric(Base):
    """A named thing a team measures on its board."""

    __tablename__ = "metrics"
    __table_args__ = (
        # The same pattern as team names: the index decides a duplicate, so
        # two concurrent additions cannot both pass a read-then-write check.
        Index("uq_metrics_team_name_lower", "team_id", text("lower(name)"), unique=True),
        CheckConstraint("btrim(name) <> ''", name="ck_metrics_name_not_blank"),
        CheckConstraint(
            f"decimals BETWEEN 0 AND {METRIC_DECIMALS_MAX}", name="ck_metrics_decimals"
        ),
        Index("ix_metrics_owner_employee_id", "owner_employee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(METRIC_NAME_MAX_LENGTH), nullable=False)
    unit: Mapped[str] = mapped_column(String(METRIC_UNIT_MAX_LENGTH), nullable=False, default="")
    decimals: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    direction: Mapped[Direction] = mapped_column(
        _enum(Direction, "metric_direction"), nullable=False
    )
    group_label: Mapped[str | None] = mapped_column(String(METRIC_GROUP_MAX_LENGTH), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # RESTRICT, as for hosts: an owner keeps resolving after leaving the team.
    owner_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=True
    )
    retired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    owner: Mapped[Employee | None] = relationship(lazy="joined")


class MetricThreshold(Base):
    """One version of what green and amber mean for a metric, from a date on.

    Append-only: a mistake is corrected by a newer version, never an edit, so
    the history of what each past meeting was judged against stays complete.
    Which bounds are set depends on the metric's direction; see the design.
    """

    __tablename__ = "metric_thresholds"
    __table_args__ = (
        # A comparison with NULL passes a check, so each of these binds only
        # where both of its sides are present - exactly the ordering wanted.
        CheckConstraint("amber_lo <= green_lo", name="ck_metric_thresholds_lower_order"),
        CheckConstraint("green_lo <= green_hi", name="ck_metric_thresholds_green_order"),
        CheckConstraint("green_hi <= amber_hi", name="ck_metric_thresholds_upper_order"),
        # An amber bound without its green bound, or the reverse, is no zone.
        CheckConstraint(
            "(green_lo IS NULL) = (amber_lo IS NULL)", name="ck_metric_thresholds_lower_pair"
        ),
        CheckConstraint(
            "(green_hi IS NULL) = (amber_hi IS NULL)", name="ck_metric_thresholds_upper_pair"
        ),
        CheckConstraint(
            "green_lo IS NOT NULL OR green_hi IS NOT NULL", name="ck_metric_thresholds_some_bound"
        ),
        CheckConstraint("btrim(reason) <> ''", name="ck_metric_thresholds_reason_not_blank"),
        Index("ix_metric_thresholds_metric_effective", "metric_id", "effective_from"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metrics.id", ondelete="CASCADE"), nullable=False
    )
    effective_from: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    green_lo: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    green_hi: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    amber_lo: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    amber_hi: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_by_email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), nullable=False)
    recorded_at: Mapped[datetime.datetime] = mapped_column(
        # clock_timestamp rather than now(): two versions recorded in one
        # transaction must still be told apart by when they were recorded.
        DateTime(timezone=True),
        nullable=False,
        server_default=func.clock_timestamp(),
    )


class MetricValue(Base):
    """The number, comment and colour recorded for one metric at one meeting."""

    __tablename__ = "metric_values"
    __table_args__ = (
        CheckConstraint(
            "manual_status IS NULL OR btrim(coalesce(comment, '')) <> ''",
            name="ck_metric_values_manual_status_has_comment",
        ),
        Index("ix_metric_values_meeting_id", "meeting_id"),
    )

    # RESTRICT on both: a recorded value keeps its metric and its meeting.
    metric_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metrics.id", ondelete="RESTRICT"), primary_key=True
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="RESTRICT"), primary_key=True
    )
    value: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    manual_status: Mapped[Colour | None] = mapped_column(
        _enum(Colour, "metric_value_manual_status"), nullable=True
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), nullable=False)
    recorded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MetricValueCorrection(Base):
    """An administrator's change to a value at a frozen meeting. Never edited."""

    __tablename__ = "metric_value_corrections"
    __table_args__ = (
        CheckConstraint("btrim(reason) <> ''", name="ck_metric_value_corrections_reason"),
        Index("ix_metric_value_corrections_metric_id", "metric_id"),
        Index("ix_metric_value_corrections_meeting_id", "meeting_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metrics.id", ondelete="RESTRICT"), nullable=False
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="RESTRICT"), nullable=False
    )
    old_value: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    old_manual_status: Mapped[Colour | None] = mapped_column(
        _enum(Colour, "metric_value_correction_old_status"), nullable=True
    )
    old_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[Decimal | None] = mapped_column(_number(), nullable=True)
    new_manual_status: Mapped[Colour | None] = mapped_column(
        _enum(Colour, "metric_value_correction_new_status"), nullable=True
    )
    new_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_by_email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), nullable=False)
    corrected_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
