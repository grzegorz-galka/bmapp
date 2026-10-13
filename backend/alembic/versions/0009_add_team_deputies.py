"""Add `team_members.is_deputy`: a member may be one of the team's leader deputies.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-13

A column with a server default of false and a check that nobody is both leader
and deputy; every existing row satisfies it. The downgrade loses the deputies
recorded meanwhile, which confer permissions only, not data.
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "team_members",
        sa.Column("is_deputy", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_check_constraint(
        "ck_team_members_not_leader_and_deputy",
        "team_members",
        "NOT (is_leader AND is_deputy)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_team_members_not_leader_and_deputy", "team_members", type_="check")
    op.drop_column("team_members", "is_deputy")
