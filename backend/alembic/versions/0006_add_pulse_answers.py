"""Add `pulse_answers`: each member's rating and three texts for one meeting.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-12

A new table only; nothing existing moves.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

TEXT_MAX_LENGTH = 2000


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def _text_length_check(column: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column}) <= {TEXT_MAX_LENGTH}",
        name=f"ck_pulse_answers_{column}_length",
    )


def upgrade() -> None:
    op.create_table(
        "pulse_answers",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("meeting_id", _uuid(), nullable=False),
        sa.Column("employee_id", _uuid(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("positive", sa.Text(), server_default="", nullable=False),
        sa.Column("negative", sa.Text(), server_default="", nullable=False),
        sa.Column("better", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_pulse_answers_rating"),
        _text_length_check("positive"),
        _text_length_check("negative"),
        _text_length_check("better"),
        # RESTRICT on both: an answer keeps its meeting and its respondent.
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id", "employee_id", name="uq_pulse_answers_meeting_employee"),
    )
    op.create_index("ix_pulse_answers_employee_id", "pulse_answers", ["employee_id"])


def downgrade() -> None:
    op.drop_index("ix_pulse_answers_employee_id", table_name="pulse_answers")
    op.drop_table("pulse_answers")
