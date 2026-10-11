"""Move a metric's place on a board into `board_metrics`, and allow global metrics.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-12

Every existing metric gets one placement on its own board, carrying its old
position, group, owner and retirement, before those columns leave `metrics`.
No metric value moves: a value already belongs to a meeting, hence a team.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "board_metrics",
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("metric_id", _uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("group_label", sa.String(length=200), nullable=True),
        sa.Column("owner_employee_id", _uuid(), nullable=True),
        sa.Column("retired", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="CASCADE"),
        # An owner keeps resolving to someone after leaving the team.
        sa.ForeignKeyConstraint(["owner_employee_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("team_id", "metric_id"),
    )
    op.create_index("ix_board_metrics_owner_employee_id", "board_metrics", ["owner_employee_id"])
    op.execute(
        "INSERT INTO board_metrics"
        " (team_id, metric_id, position, group_label, owner_employee_id, retired, created_at)"
        " SELECT team_id, id, position, group_label, owner_employee_id, retired, created_at"
        " FROM metrics"
    )

    op.drop_index("ix_metrics_owner_employee_id", table_name="metrics")
    op.drop_column("metrics", "owner_employee_id")
    op.drop_column("metrics", "group_label")
    op.drop_column("metrics", "position")
    # An own metric's retirement now lives on its placement only.
    op.execute("UPDATE metrics SET retired = false")

    op.alter_column("metrics", "team_id", existing_type=_uuid(), nullable=True)
    op.create_index(
        "uq_metrics_global_name_lower",
        "metrics",
        [sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("team_id IS NULL"),
    )
    op.create_check_constraint(
        "ck_metrics_global_only_retired", "metrics", "team_id IS NULL OR NOT retired"
    )


def downgrade() -> None:
    # A global metric has no board column to go back to; dropping it silently
    # would take its values with it.
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM metrics WHERE team_id IS NULL)")):
        raise RuntimeError(
            "Cannot downgrade below 0005 while a global metric exists; delete them first."
        )

    op.drop_constraint("ck_metrics_global_only_retired", "metrics", type_="check")
    op.drop_index("uq_metrics_global_name_lower", table_name="metrics")
    op.alter_column("metrics", "team_id", existing_type=_uuid(), nullable=False)

    op.add_column("metrics", sa.Column("position", sa.Integer(), nullable=True))
    op.add_column("metrics", sa.Column("group_label", sa.String(length=200), nullable=True))
    op.add_column("metrics", sa.Column("owner_employee_id", _uuid(), nullable=True))
    # With no global metric, every placement is its metric's own one.
    op.execute(
        "UPDATE metrics SET position = b.position, group_label = b.group_label,"
        " owner_employee_id = b.owner_employee_id, retired = b.retired"
        " FROM board_metrics b WHERE b.metric_id = metrics.id AND b.team_id = metrics.team_id"
    )
    op.alter_column("metrics", "position", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "metrics_owner_employee_id_fkey",
        "metrics",
        "employees",
        ["owner_employee_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_metrics_owner_employee_id", "metrics", ["owner_employee_id"])

    op.drop_index("ix_board_metrics_owner_employee_id", table_name="board_metrics")
    op.drop_table("board_metrics")
