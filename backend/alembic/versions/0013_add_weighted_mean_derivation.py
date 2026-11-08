"""Add the `weighted_mean` derivation kind and a weight on each derivation source.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-07

`metrics.derivation_kind` is a VARCHAR held by the check constraint
`metric_derivation_kind`, so the kind is added by rewriting that constraint.
`metric_derivation_sources.weight` is nullable: no existing derivation is a
weighted mean, so nothing is backfilled. The downgrade refuses while any
metric is a weighted mean, rather than quietly turning it into another kind.
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

# Repeated rather than imported: a migration must keep meaning what it meant
# when it was written, whatever the application module later becomes.
KINDS_BEFORE = ("mean", "sum", "delta")
KINDS_AFTER = ("mean", "sum", "weighted_mean", "delta")


def _kinds_check(kinds: tuple[str, ...]) -> str:
    listed = ", ".join(f"'{kind}'" for kind in kinds)
    return f"derivation_kind IN ({listed})"


def upgrade() -> None:
    op.drop_constraint("metric_derivation_kind", "metrics", type_="check")
    op.create_check_constraint("metric_derivation_kind", "metrics", _kinds_check(KINDS_AFTER))
    op.add_column(
        "metric_derivation_sources",
        sa.Column("weight", sa.Numeric(21, 6), nullable=True),
    )
    op.create_check_constraint(
        "ck_metric_derivation_sources_weight_positive",
        "metric_derivation_sources",
        "weight IS NULL OR weight > 0",
    )


def downgrade() -> None:
    weighted = (
        op.get_bind()
        .execute(sa.text("SELECT count(*) FROM metrics WHERE derivation_kind = 'weighted_mean'"))
        .scalar_one()
    )
    if weighted:
        raise RuntimeError(
            f"{weighted} metric(s) are derived as a weighted mean; change or remove those "
            "derivations before downgrading, or they would lose their weights."
        )
    op.drop_constraint(
        "ck_metric_derivation_sources_weight_positive", "metric_derivation_sources", type_="check"
    )
    op.drop_column("metric_derivation_sources", "weight")
    op.drop_constraint("metric_derivation_kind", "metrics", type_="check")
    op.create_check_constraint("metric_derivation_kind", "metrics", _kinds_check(KINDS_BEFORE))
