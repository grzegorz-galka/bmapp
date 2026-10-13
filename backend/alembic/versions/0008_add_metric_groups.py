"""Add `metric_groups`: a board's own named, ordered groups, replacing the free-text label.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-13

Each board's distinct group labels become its groups. Labels equal regardless
of case and surrounding spaces become one group, spelled as on the metric shown
first; the groups are ordered as the board showed them, by the position of
their first metric. Positions are then renumbered 0..n-1 within each group and
among the ungrouped metrics, keeping every metric's relative order.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
GROUP_NAME_MAX_LENGTH = 200


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "metric_groups",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("name", sa.String(length=GROUP_NAME_MAX_LENGTH), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_metric_groups_name_not_blank"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_metric_groups_team_name_lower",
        "metric_groups",
        ["team_id", sa.text("lower(name)")],
        unique=True,
    )
    op.add_column("board_metrics", sa.Column("group_id", _uuid(), nullable=True))
    op.create_foreign_key(
        "board_metrics_group_id_fkey",
        "board_metrics",
        "metric_groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_board_metrics_group_id", "board_metrics", ["group_id"])

    op.execute(
        """
        WITH labelled AS (
            SELECT bm.team_id,
                   btrim(bm.group_label) AS label,
                   lower(btrim(bm.group_label)) AS label_key,
                   bm.position,
                   lower(m.name) AS metric_name
            FROM board_metrics bm
            JOIN metrics m ON m.id = bm.metric_id
            WHERE btrim(coalesce(bm.group_label, '')) <> ''
        ),
        merged AS (
            SELECT team_id,
                   (array_agg(label ORDER BY position, metric_name))[1] AS name,
                   min(position) AS first_position,
                   min(metric_name) AS first_name
            FROM labelled
            GROUP BY team_id, label_key
        )
        INSERT INTO metric_groups (id, team_id, name, position)
        SELECT gen_random_uuid(),
               team_id,
               name,
               row_number() OVER (PARTITION BY team_id ORDER BY first_position, first_name) - 1
        FROM merged
        """
    )
    op.execute(
        """
        UPDATE board_metrics bm
        SET group_id = g.id
        FROM metric_groups g
        WHERE g.team_id = bm.team_id
          AND lower(g.name) = lower(btrim(bm.group_label))
        """
    )
    op.execute(
        """
        UPDATE board_metrics bm
        SET position = ranked.position
        FROM (
            SELECT p.team_id,
                   p.metric_id,
                   row_number() OVER (
                       PARTITION BY p.team_id, p.group_id ORDER BY p.position, lower(m.name)
                   ) - 1 AS position
            FROM board_metrics p
            JOIN metrics m ON m.id = p.metric_id
        ) ranked
        WHERE ranked.team_id = bm.team_id AND ranked.metric_id = bm.metric_id
        """
    )
    op.drop_column("board_metrics", "group_label")


def downgrade() -> None:
    """Groups collapse back into labels; their order and the empty ones are lost.

    Positions become one sequence per board in the order the board showed, so
    the label-era ordering by position still reads the same.
    """
    op.add_column(
        "board_metrics",
        sa.Column("group_label", sa.String(length=GROUP_NAME_MAX_LENGTH), nullable=True),
    )
    op.execute(
        """
        UPDATE board_metrics bm
        SET group_label = g.name
        FROM metric_groups g
        WHERE g.id = bm.group_id
        """
    )
    op.execute(
        """
        UPDATE board_metrics bm
        SET position = ranked.position
        FROM (
            SELECT p.team_id,
                   p.metric_id,
                   row_number() OVER (
                       PARTITION BY p.team_id
                       ORDER BY g.position NULLS LAST, p.position, lower(m.name)
                   ) - 1 AS position
            FROM board_metrics p
            JOIN metrics m ON m.id = p.metric_id
            LEFT JOIN metric_groups g ON g.id = p.group_id
        ) ranked
        WHERE ranked.team_id = bm.team_id AND ranked.metric_id = bm.metric_id
        """
    )
    op.drop_index("ix_board_metrics_group_id", table_name="board_metrics")
    op.drop_constraint("board_metrics_group_id_fkey", "board_metrics", type_="foreignkey")
    op.drop_column("board_metrics", "group_id")
    op.drop_index("uq_metric_groups_team_name_lower", table_name="metric_groups")
    op.drop_table("metric_groups")
