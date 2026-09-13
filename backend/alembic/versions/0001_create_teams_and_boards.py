"""Create the teams and board_definitions tables.

Revision ID: 0001
Revises:
Create Date: 2026-09-13

This is the base of the migration chain: every later revision descends from it.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

TEAM_NAME_MAX_LENGTH = 200


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=TEAM_NAME_MAX_LENGTH), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_teams_name_not_blank"),
    )
    # Case-insensitive uniqueness, enforced by the database so that two
    # concurrent registrations cannot both succeed.
    op.create_index("ix_teams_name_lower", "teams", [sa.text("lower(name)")], unique=True)

    op.create_table(
        "board_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=TEAM_NAME_MAX_LENGTH), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        # One board per team.
        sa.UniqueConstraint("team_id", name="uq_board_definitions_team_id"),
    )


def downgrade() -> None:
    op.drop_table("board_definitions")
    op.drop_index("ix_teams_name_lower", table_name="teams")
    op.drop_table("teams")
