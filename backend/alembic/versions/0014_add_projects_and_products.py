"""Add the projects and products a team follows, and their metrics.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-06

Creates `projects` and `products`, adds `metrics.project_id` and
`metrics.product_id` with composite foreign keys that keep a metric on a
project or product of its own team, allows at most one of the two, and
replaces `ck_metrics_derivation_own` so that such a metric is never derived.
The team-wide name index becomes partial, covering only the board's other
own metrics, beside one index per project and one per product. No data moves:
no existing metric has a project or product, so the partial index admits
exactly what the old one did.

The downgrade keeps every metric: a project's or product's metric becomes an
ordinary metric of its team's board, and the projects and products are
dropped. It therefore fails once two metrics of one team's projects or
products share a name, or one shares a name with the board's own metric,
because the old team-wide name index cannot be rebuilt over them. That is
accepted; rename one of them first.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def _uuid() -> postgresql.UUID:  # type: ignore[type-arg]
    return postgresql.UUID(as_uuid=True)


def _created_at() -> sa.Column:  # type: ignore[type-arg]
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("manager_employee_id", _uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        _created_at(),
        sa.CheckConstraint("btrim(code) <> ''", name="ck_projects_code_not_blank"),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_projects_name_not_blank"),
        sa.CheckConstraint("start_date <= end_date", name="ck_projects_dates_order"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["manager_employee_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "team_id", name="uq_projects_id_team"),
    )
    op.create_index("uq_projects_code_lower", "projects", [sa.text("lower(code)")], unique=True)
    op.create_index("ix_projects_team_id", "projects", ["team_id"])
    op.create_index("ix_projects_manager_employee_id", "projects", ["manager_employee_id"])

    op.create_table(
        "products",
        sa.Column("id", _uuid(), nullable=False),
        sa.Column("team_id", _uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("owner_employee_id", _uuid(), nullable=False),
        sa.Column("jira_url", sa.String(length=2000), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        _created_at(),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_products_name_not_blank"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_employee_id"], ["employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "team_id", name="uq_products_id_team"),
    )
    op.create_index(
        "uq_products_team_name_lower",
        "products",
        ["team_id", sa.text("lower(name)")],
        unique=True,
    )
    op.create_index("ix_products_owner_employee_id", "products", ["owner_employee_id"])

    op.add_column("metrics", sa.Column("project_id", _uuid(), nullable=True))
    op.add_column("metrics", sa.Column("product_id", _uuid(), nullable=True))
    op.create_foreign_key(
        "fk_metrics_project_team",
        "metrics",
        "projects",
        ["project_id", "team_id"],
        ["id", "team_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_metrics_product_team",
        "metrics",
        "products",
        ["product_id", "team_id"],
        ["id", "team_id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_metrics_one_parent", "metrics", "num_nonnulls(project_id, product_id) <= 1"
    )
    op.drop_constraint("ck_metrics_derivation_own", "metrics", type_="check")
    op.create_check_constraint(
        "ck_metrics_derivation_own",
        "metrics",
        "derivation_kind IS NULL"
        " OR (team_id IS NOT NULL AND project_id IS NULL AND product_id IS NULL)",
    )
    op.create_index("ix_metrics_project_id", "metrics", ["project_id"])
    op.create_index("ix_metrics_product_id", "metrics", ["product_id"])

    op.drop_index("uq_metrics_team_name_lower", table_name="metrics")
    op.create_index(
        "uq_metrics_team_name_lower",
        "metrics",
        ["team_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("project_id IS NULL AND product_id IS NULL"),
    )
    op.create_index(
        "uq_metrics_project_name_lower",
        "metrics",
        ["project_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("project_id IS NOT NULL"),
    )
    op.create_index(
        "uq_metrics_product_name_lower",
        "metrics",
        ["product_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("product_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_metrics_product_name_lower", table_name="metrics")
    op.drop_index("uq_metrics_project_name_lower", table_name="metrics")
    op.drop_index("uq_metrics_team_name_lower", table_name="metrics")
    op.create_index(
        "uq_metrics_team_name_lower", "metrics", ["team_id", sa.text("lower(name)")], unique=True
    )
    op.drop_index("ix_metrics_product_id", table_name="metrics")
    op.drop_index("ix_metrics_project_id", table_name="metrics")
    op.drop_constraint("ck_metrics_derivation_own", "metrics", type_="check")
    op.create_check_constraint(
        "ck_metrics_derivation_own", "metrics", "derivation_kind IS NULL OR team_id IS NOT NULL"
    )
    op.drop_constraint("ck_metrics_one_parent", "metrics", type_="check")
    op.drop_constraint("fk_metrics_product_team", "metrics", type_="foreignkey")
    op.drop_constraint("fk_metrics_project_team", "metrics", type_="foreignkey")
    op.drop_column("metrics", "product_id")
    op.drop_column("metrics", "project_id")

    op.drop_index("ix_products_owner_employee_id", table_name="products")
    op.drop_index("uq_products_team_name_lower", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_projects_manager_employee_id", table_name="projects")
    op.drop_index("ix_projects_team_id", table_name="projects")
    op.drop_index("uq_projects_code_lower", table_name="projects")
    op.drop_table("projects")
