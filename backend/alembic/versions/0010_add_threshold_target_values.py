"""Add a threshold version's target value and tolerances, and hiding a metric on a board.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-01

Three nullable columns on `metric_thresholds` and the checks that tie them to
the boundaries: a non-zero target value comes with tolerances and no
boundary, anything else with boundaries as before. Every existing version has
no target value, so it satisfies the checks unchanged and is still judged by
its boundaries: no status changes. `board_metrics.hidden` defaults to false.

The downgrade refuses while any version has a target value: dropping it would
lose what that version means, and versions are never edited to get rid of it.
"""

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

_OLD_SOME_BOUND = "green_lo IS NOT NULL OR green_hi IS NOT NULL"


def upgrade() -> None:
    op.add_column("metric_thresholds", sa.Column("target_value", sa.Numeric(21, 6), nullable=True))
    op.add_column("metric_thresholds", sa.Column("green_pct", sa.Numeric(21, 6), nullable=True))
    op.add_column("metric_thresholds", sa.Column("amber_pct", sa.Numeric(21, 6), nullable=True))
    op.drop_constraint("ck_metric_thresholds_some_bound", "metric_thresholds", type_="check")
    op.create_check_constraint(
        "ck_metric_thresholds_some_bound",
        "metric_thresholds",
        "green_pct IS NOT NULL OR green_lo IS NOT NULL OR green_hi IS NOT NULL",
    )
    op.create_check_constraint(
        "ck_metric_thresholds_tolerance_shape",
        "metric_thresholds",
        "(target_value IS NOT NULL AND target_value <> 0)"
        " = (green_pct IS NOT NULL AND amber_pct IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_metric_thresholds_tolerances_or_bounds",
        "metric_thresholds",
        "green_pct IS NULL OR (green_lo IS NULL AND green_hi IS NULL"
        " AND amber_lo IS NULL AND amber_hi IS NULL)",
    )
    op.create_check_constraint(
        "ck_metric_thresholds_tolerance_order",
        "metric_thresholds",
        "0 <= green_pct AND green_pct <= amber_pct",
    )
    op.add_column(
        "board_metrics",
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    with_target = op.get_bind().scalar(
        sa.text("SELECT count(*) FROM metric_thresholds WHERE target_value IS NOT NULL")
    )
    if with_target:
        raise RuntimeError(
            f"{with_target} threshold versions have a target value; downgrading would lose"
            " what they mean. Record newer versions instead of downgrading."
        )
    op.drop_column("board_metrics", "hidden")
    op.drop_constraint("ck_metric_thresholds_tolerance_order", "metric_thresholds", type_="check")
    op.drop_constraint(
        "ck_metric_thresholds_tolerances_or_bounds", "metric_thresholds", type_="check"
    )
    op.drop_constraint("ck_metric_thresholds_tolerance_shape", "metric_thresholds", type_="check")
    op.drop_constraint("ck_metric_thresholds_some_bound", "metric_thresholds", type_="check")
    op.create_check_constraint(
        "ck_metric_thresholds_some_bound", "metric_thresholds", _OLD_SOME_BOUND
    )
    op.drop_column("metric_thresholds", "amber_pct")
    op.drop_column("metric_thresholds", "green_pct")
    op.drop_column("metric_thresholds", "target_value")
