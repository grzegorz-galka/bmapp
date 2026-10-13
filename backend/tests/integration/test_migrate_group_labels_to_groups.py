"""Migration 0008 turns a board's free-text group labels into its groups.

Run against a database of its own, migrated to the revision before, loaded
with labels, and then upgraded: the shared test database is already at head.
"""

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy.engine import Connection, make_url

from alembic import command
from tests.conftest import _test_database_url

TEAM = uuid.uuid4()
#: Name -> (label, position) as the label-era board had them.
PLACEMENTS = {
    "Morale": (None, 5),
    "Bugs": ("Quality", 10),
    "Revenue": ("Finance", 15),
    "Defects": ("quality ", 20),
}


@pytest.fixture
def migration_url() -> Iterator[str]:
    """A fresh database next to the test database, dropped afterwards."""
    url = make_url(_test_database_url())
    target = url.set(database=f"{url.database}_migration")
    admin = sa.create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(sa.text(f'DROP DATABASE IF EXISTS "{target.database}"'))
        connection.execute(sa.text(f'CREATE DATABASE "{target.database}"'))
    try:
        yield target.render_as_string(hide_password=False)
    finally:
        with admin.connect() as connection:
            connection.execute(sa.text(f'DROP DATABASE IF EXISTS "{target.database}" WITH (FORCE)'))
        admin.dispose()


def _alembic(url: str) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    return config


def _load_labels(connection: Connection) -> None:
    connection.execute(
        sa.text("INSERT INTO teams (id, name) VALUES (:id, 'Platform')"), {"id": TEAM}
    )
    for name, (label, position) in PLACEMENTS.items():
        metric_id = uuid.uuid4()
        connection.execute(
            sa.text(
                "INSERT INTO metrics (id, team_id, name, unit, decimals, direction, retired)"
                " VALUES (:id, :team, :name, '', 0, 'higher_is_better', false)"
            ),
            {"id": metric_id, "team": TEAM, "name": name},
        )
        connection.execute(
            sa.text(
                "INSERT INTO board_metrics (team_id, metric_id, position, group_label, retired)"
                " VALUES (:team, :metric, :position, :label, false)"
            ),
            {"team": TEAM, "metric": metric_id, "position": position, "label": label},
        )


def test_labels_differing_in_case_and_spaces_become_one_group_in_board_order(
    migration_url: str,
) -> None:
    config = _alembic(migration_url)
    command.upgrade(config, "0007")
    engine = sa.create_engine(migration_url)
    with engine.begin() as connection:
        _load_labels(connection)

    command.upgrade(config, "0008")

    with engine.connect() as connection:
        groups = connection.execute(
            sa.text("SELECT name, position FROM metric_groups ORDER BY position")
        ).all()
        placements = connection.execute(
            sa.text(
                "SELECT m.name, g.name, p.position FROM board_metrics p"
                " JOIN metrics m ON m.id = p.metric_id"
                " LEFT JOIN metric_groups g ON g.id = p.group_id"
                " ORDER BY g.position NULLS LAST, p.position"
            )
        ).all()
    engine.dispose()

    assert [tuple(row) for row in groups] == [("Quality", 0), ("Finance", 1)]
    assert [tuple(row) for row in placements] == [
        ("Bugs", "Quality", 0),
        ("Defects", "Quality", 1),
        ("Revenue", "Finance", 0),
        ("Morale", None, 0),
    ]


def test_a_downgrade_restores_the_labels_in_the_order_the_board_showed(
    migration_url: str,
) -> None:
    config = _alembic(migration_url)
    command.upgrade(config, "0007")
    engine = sa.create_engine(migration_url)
    with engine.begin() as connection:
        _load_labels(connection)
    command.upgrade(config, "0008")

    command.downgrade(config, "0007")

    with engine.connect() as connection:
        placements = connection.execute(
            sa.text(
                "SELECT m.name, p.group_label FROM board_metrics p"
                " JOIN metrics m ON m.id = p.metric_id ORDER BY p.position"
            )
        ).all()
    engine.dispose()

    assert [tuple(row) for row in placements] == [
        ("Bugs", "Quality"),
        ("Defects", "Quality"),
        ("Revenue", "Finance"),
        ("Morale", None),
    ]
