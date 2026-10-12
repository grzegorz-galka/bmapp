"""Add `problems` and `tasks`: a team's items, their PDCA stage and their meetings.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-12

Two new tables of one shape and no backfill, so this runs over any database.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
STAGES = ("not_started", "plan", "do", "check", "act")
SUMMARY_MAX_LENGTH = 500
TEXT_MAX_LENGTH = 4000


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def _stage() -> sa.Enum:
    """A VARCHAR with a check constraint, not a native enum."""
    return sa.Enum(*STAGES, name="pdca_stage", native_enum=False, create_constraint=True, length=20)


def _shared_columns() -> list[sa.Column]:  # type: ignore[type-arg]
    """The columns a problem and a task share, in a fresh copy for each table."""
    return [
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("summary", sa.String(length=SUMMARY_MAX_LENGTH), nullable=False),
        sa.Column("responsible_employee_id", _uuid(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("metric_id", _uuid(), nullable=True),
        sa.Column("stage", _stage(), server_default="not_started", nullable=False),
        sa.Column("raised_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raised_meeting_id", _uuid(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_meeting_id", _uuid(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def _shared_constraints(table: str, *text_columns: str) -> list[sa.Constraint]:
    return [
        # Archived is closed_at, and only ever at `act`.
        sa.CheckConstraint(
            "(stage = 'act') = (closed_at IS NOT NULL)", name=f"ck_{table}_closed_at_act"
        ),
        sa.CheckConstraint("btrim(summary) <> ''", name=f"ck_{table}_summary_not_blank"),
        *(
            sa.CheckConstraint(
                f"char_length({column}) <= {TEXT_MAX_LENGTH}", name=f"ck_{table}_{column}_length"
            )
            for column in text_columns
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        # A responsible person keeps resolving after leaving the team.
        sa.ForeignKeyConstraint(["responsible_employee_id"], ["employees.id"], ondelete="RESTRICT"),
        # Deleting a metric added by mistake, or a meeting opened by mistake,
        # is not blocked by an item that points at it.
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["raised_meeting_id"], ["meetings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["closed_meeting_id"], ["meetings.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    ]


def _shared_indexes(table: str) -> None:
    op.create_index(f"ix_{table}_team_closed_at", table, ["team_id", "closed_at"])
    op.create_index(
        f"ix_{table}_responsible_active",
        table,
        ["responsible_employee_id"],
        postgresql_where=sa.text("closed_at IS NULL"),
    )


def upgrade() -> None:
    op.create_table(
        "problems",
        *_shared_columns(),
        sa.Column("reason", sa.Text(), server_default="", nullable=False),
        sa.Column("solution", sa.Text(), server_default="", nullable=False),
        *_shared_constraints("problems", "reason", "solution"),
    )
    _shared_indexes("problems")

    op.create_table(
        "tasks",
        *_shared_columns(),
        sa.Column("details", sa.Text(), server_default="", nullable=False),
        sa.Column("problem_id", _uuid(), nullable=True),
        *_shared_constraints("tasks", "details"),
        # Problems are never deleted; this states that rule in the schema too.
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="RESTRICT"),
    )
    _shared_indexes("tasks")


def downgrade() -> None:
    for table in ("tasks", "problems"):
        op.drop_index(f"ix_{table}_responsible_active", table_name=table)
        op.drop_index(f"ix_{table}_team_closed_at", table_name=table)
        op.drop_table(table)
