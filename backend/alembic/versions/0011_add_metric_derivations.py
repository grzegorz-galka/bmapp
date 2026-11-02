"""Add a board's own metric's derivation: its kind and its ordered sources.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-01

A nullable `metrics.derivation_kind`, held to a board's own metric, and the
`metric_derivation_sources` table. No existing metric is derived, so nothing
is backfilled; the downgrade drops both, losing only derivations, never a
recorded value.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
DERIVATION_KINDS = ("mean", "sum", "delta")


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "metrics",
        sa.Column(
            "derivation_kind",
            sa.Enum(
                *DERIVATION_KINDS,
                name="metric_derivation_kind",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        "ck_metrics_derivation_own", "metrics", "derivation_kind IS NULL OR team_id IS NOT NULL"
    )
    op.create_table(
        "metric_derivation_sources",
        sa.Column("metric_id", _uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("source_team_id", _uuid(), nullable=False),
        sa.Column("source_metric_id", _uuid(), nullable=False),
        sa.ForeignKeyConstraint(["metric_id"], ["metrics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_metric_id"], ["metrics.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("metric_id", "position"),
        sa.UniqueConstraint(
            "metric_id",
            "source_team_id",
            "source_metric_id",
            name="uq_metric_derivation_sources_source",
        ),
    )
    op.create_index(
        "ix_metric_derivation_sources_source",
        "metric_derivation_sources",
        ["source_metric_id", "source_team_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_metric_derivation_sources_source", table_name="metric_derivation_sources")
    op.drop_table("metric_derivation_sources")
    op.drop_constraint("ck_metrics_derivation_own", "metrics", type_="check")
    op.drop_column("metrics", "derivation_kind")
