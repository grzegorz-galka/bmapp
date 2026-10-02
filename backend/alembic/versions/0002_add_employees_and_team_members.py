"""Add employees and their membership of teams.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03

Every team must have a leader from now on, and a team registered before this
revision has none that could be inferred. Rather than leave such teams
breaking the invariant from the first read, the upgrade refuses to run while
any team exists. Nothing is deployed, so only local databases are affected.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

EMAIL_MAX_LENGTH = 254


def upgrade() -> None:
    team_count = op.get_bind().execute(sa.text("SELECT count(*) FROM teams")).scalar_one()
    if team_count:
        raise RuntimeError(
            f"Migration 0002 cannot run: the database holds {team_count} team(s) registered "
            "before teams had leaders, and no leader can be assigned to them automatically. "
            "Reset the local database with `docker compose down -v`, then run "
            "`docker compose up -d` and `alembic upgrade head` again."
        )

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=EMAIL_MAX_LENGTH), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        # A non-normalised email can never be stored, whatever the caller does.
        sa.CheckConstraint("email = lower(btrim(email))", name="ck_employees_email_normalised"),
    )

    op.create_table(
        "team_members",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_leader", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("team_id", "employee_id"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        # An employee who still belongs to a team can never be deleted.
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="RESTRICT"),
    )
    # At most one leader per team, enforced by the database.
    op.create_index(
        "uq_team_members_one_leader",
        "team_members",
        ["team_id"],
        unique=True,
        postgresql_where=sa.text("is_leader"),
    )
    op.create_index("ix_team_members_employee_id", "team_members", ["employee_id"])


def downgrade() -> None:
    op.drop_index("ix_team_members_employee_id", table_name="team_members")
    op.drop_index("uq_team_members_one_leader", table_name="team_members")
    op.drop_table("team_members")
    op.drop_table("employees")
