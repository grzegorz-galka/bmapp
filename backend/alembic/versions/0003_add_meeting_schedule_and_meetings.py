"""Add the meeting schedule of a board and the meetings a team holds.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-10

Existing boards simply have no schedule, so this runs over any database.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

EMAIL_MAX_LENGTH = 254

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
LOCAL_DATE_SQL = "((starts_at AT TIME ZONE 'Europe/Warsaw')::date)"


def upgrade() -> None:
    op.add_column("board_definitions", sa.Column("schedule_weekday", sa.SmallInteger()))
    op.add_column("board_definitions", sa.Column("schedule_time", sa.Time()))
    op.create_check_constraint(
        "ck_board_definitions_schedule_weekday",
        "board_definitions",
        "schedule_weekday BETWEEN 1 AND 7",
    )
    op.create_check_constraint(
        "ck_board_definitions_schedule_complete",
        "board_definitions",
        "(schedule_weekday IS NULL) = (schedule_time IS NULL)",
    )

    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("host_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by_email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        # A host keeps resolving to someone even after leaving the team.
        sa.ForeignKeyConstraint(["host_employee_id"], ["employees.id"], ondelete="RESTRICT"),
    )
    # One meeting per team per date, as the organization's clock reads it.
    op.create_index(
        "uq_meetings_team_local_date",
        "meetings",
        ["team_id", sa.text(LOCAL_DATE_SQL)],
        unique=True,
    )
    op.create_index("ix_meetings_host_employee_id", "meetings", ["host_employee_id"])


def downgrade() -> None:
    op.drop_index("ix_meetings_host_employee_id", table_name="meetings")
    op.drop_index("uq_meetings_team_local_date", table_name="meetings")
    op.drop_table("meetings")
    op.drop_constraint("ck_board_definitions_schedule_complete", "board_definitions")
    op.drop_constraint("ck_board_definitions_schedule_weekday", "board_definitions")
    op.drop_column("board_definitions", "schedule_time")
    op.drop_column("board_definitions", "schedule_weekday")
