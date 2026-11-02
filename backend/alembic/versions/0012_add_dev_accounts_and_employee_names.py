"""Add `employees.name` and `employees.surname`, and the `dev_credentials` table.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-02

The name columns are nullable and nothing is backfilled: a person with neither
is named from their email when read, and storing that guess would make it
indistinguishable from a real name. `dev_credentials` holds the passwords
development-mode accounts choose; it has no foreign key to `employees` because
an administrator may sign in with no employee record. It exists in every
environment, but only the development-mode routes read or write it. The
downgrade loses the chosen passwords and stored names, after which development
sign-in falls back to the derived password.
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employees", sa.Column("name", sa.String(length=100), nullable=True))
    op.add_column("employees", sa.Column("surname", sa.String(length=100), nullable=True))
    op.create_table(
        "dev_credentials",
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "email = lower(btrim(email))", name="ck_dev_credentials_email_normalised"
        ),
        sa.PrimaryKeyConstraint("email"),
    )


def downgrade() -> None:
    op.drop_table("dev_credentials")
    op.drop_column("employees", "surname")
    op.drop_column("employees", "name")
