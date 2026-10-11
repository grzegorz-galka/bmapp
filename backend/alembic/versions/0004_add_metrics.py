"""Add a board's metrics, their threshold versions, values and corrections.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11

Four new tables and no backfill, so this runs over any database.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
EMAIL_MAX_LENGTH = 254
DIRECTIONS = ("higher_is_better", "lower_is_better", "within_band")
COLOURS = ("green", "amber", "red")


def _number() -> sa.Numeric:  # type: ignore[type-arg]
    return sa.Numeric(precision=21, scale=6)


def _enum(values: tuple[str, ...], name: str) -> sa.Enum:
    """A VARCHAR with a check constraint, not a native enum."""
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=20)


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "metrics",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("decimals", sa.SmallInteger(), nullable=False),
        sa.Column("direction", _enum(DIRECTIONS, "metric_direction"), nullable=False),
        sa.Column("group_label", sa.String(length=200), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("owner_employee_id", _uuid(), nullable=True),
        sa.Column("retired", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_metrics_name_not_blank"),
        sa.CheckConstraint("decimals BETWEEN 0 AND 6", name="ck_metrics_decimals"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        # An owner keeps resolving to someone after leaving the team.
        sa.ForeignKeyConstraint(["owner_employee_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_metrics_team_name_lower",
        "metrics",
        ["team_id", sa.text("lower(name)")],
        unique=True,
    )
    op.create_index("ix_metrics_owner_employee_id", "metrics", ["owner_employee_id"])

    op.create_table(
        "metric_thresholds",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("metric_id", _uuid(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("green_lo", _number(), nullable=True),
        sa.Column("green_hi", _number(), nullable=True),
        sa.Column("amber_lo", _number(), nullable=True),
        sa.Column("amber_hi", _number(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("recorded_by_email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        # Each ordering binds only where both of its sides are present.
        sa.CheckConstraint("amber_lo <= green_lo", name="ck_metric_thresholds_lower_order"),
        sa.CheckConstraint("green_lo <= green_hi", name="ck_metric_thresholds_green_order"),
        sa.CheckConstraint("green_hi <= amber_hi", name="ck_metric_thresholds_upper_order"),
        sa.CheckConstraint(
            "(green_lo IS NULL) = (amber_lo IS NULL)", name="ck_metric_thresholds_lower_pair"
        ),
        sa.CheckConstraint(
            "(green_hi IS NULL) = (amber_hi IS NULL)", name="ck_metric_thresholds_upper_pair"
        ),
        sa.CheckConstraint(
            "green_lo IS NOT NULL OR green_hi IS NOT NULL", name="ck_metric_thresholds_some_bound"
        ),
        sa.CheckConstraint("btrim(reason) <> ''", name="ck_metric_thresholds_reason_not_blank"),
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_metric_thresholds_metric_effective",
        "metric_thresholds",
        ["metric_id", "effective_from"],
    )

    op.create_table(
        "metric_values",
        sa.Column("metric_id", _uuid(), nullable=False),
        sa.Column("meeting_id", _uuid(), nullable=False),
        sa.Column("value", _number(), nullable=True),
        sa.Column("manual_status", _enum(COLOURS, "metric_value_manual_status"), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("recorded_by_email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "manual_status IS NULL OR btrim(coalesce(comment, '')) <> ''",
            name="ck_metric_values_manual_status_has_comment",
        ),
        # RESTRICT on both: a recorded value keeps its metric and its meeting.
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("metric_id", "meeting_id"),
    )
    op.create_index("ix_metric_values_meeting_id", "metric_values", ["meeting_id"])

    op.create_table(
        "metric_value_corrections",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("metric_id", _uuid(), nullable=False),
        sa.Column("meeting_id", _uuid(), nullable=False),
        sa.Column("old_value", _number(), nullable=True),
        sa.Column(
            "old_manual_status",
            _enum(COLOURS, "metric_value_correction_old_status"),
            nullable=True,
        ),
        sa.Column("old_comment", sa.Text(), nullable=True),
        sa.Column("new_value", _number(), nullable=True),
        sa.Column(
            "new_manual_status",
            _enum(COLOURS, "metric_value_correction_new_status"),
            nullable=True,
        ),
        sa.Column("new_comment", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("corrected_by_email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column(
            "corrected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(reason) <> ''", name="ck_metric_value_corrections_reason"),
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_metric_value_corrections_metric_id", "metric_value_corrections", ["metric_id"]
    )
    op.create_index(
        "ix_metric_value_corrections_meeting_id", "metric_value_corrections", ["meeting_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_metric_value_corrections_meeting_id", table_name="metric_value_corrections")
    op.drop_index("ix_metric_value_corrections_metric_id", table_name="metric_value_corrections")
    op.drop_table("metric_value_corrections")
    op.drop_index("ix_metric_values_meeting_id", table_name="metric_values")
    op.drop_table("metric_values")
    op.drop_index("ix_metric_thresholds_metric_effective", table_name="metric_thresholds")
    op.drop_table("metric_thresholds")
    op.drop_index("ix_metrics_owner_employee_id", table_name="metrics")
    op.drop_index("uq_metrics_team_name_lower", table_name="metrics")
    op.drop_table("metrics")
