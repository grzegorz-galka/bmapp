"""Test fixtures.

Integration tests run against a real PostgreSQL instance, not an in-memory
substitute: the ordering and case-insensitive uniqueness requirements are
database behaviours, and passing against a different engine would prove
nothing about them.

Isolation is per test. Each test runs inside a transaction on its own
connection, which is rolled back afterwards; the session joins it with
`create_savepoint`, so a commit inside the code under test releases a
savepoint instead of ending the outer transaction. That is what lets the
suite run twice in a row with no manual reset.
"""

import os
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from alembic import command

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://bmapp:bmapp@localhost:5432/bmapp_test"


def _test_database_url() -> str:
    return os.environ.get("BMAPP_TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


def _create_database_if_missing(url: str) -> None:
    """Create the test database, connecting to the server's default database."""
    target = make_url(url)
    admin = target.set(database="postgres")
    engine = sa.create_engine(admin, isolation_level="AUTOCOMMIT")
    with engine.connect() as connection:
        exists = connection.execute(
            sa.text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": target.database},
        ).scalar()
        if not exists:
            connection.execute(sa.text(f'CREATE DATABASE "{target.database}"'))
    engine.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Create the test database, migrate it to head, and hand back an engine."""
    url = _test_database_url()
    _create_database_if_missing(url)

    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    engine = sa.create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """Give each test a session whose writes are rolled back afterwards."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    """An API client sharing the test's session, so requests roll back too."""
    from app.core.db import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
