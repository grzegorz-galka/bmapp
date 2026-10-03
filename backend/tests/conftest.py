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
from collections.abc import Callable, Iterator

import pytest
import sqlalchemy as sa
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from alembic import command

#: The suite runs in development mode, so a test can mint a token for any
#: identity without an identity broker. Set before the application is imported
#: anywhere, because the settings are read once per process. An issuer must
#: stay unset: the application refuses to start with both.
os.environ.setdefault("BMAPP_MODE", "dev")
os.environ["BMAPP_OIDC_ISSUER"] = ""

#: The administrator every test that needs one signs in as.
ADMIN_EMAIL = "admin@pse.pl"
os.environ.setdefault("BMAPP_ADMIN_EMAILS", ADMIN_EMAIL)

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
def make_client(session: Session) -> Iterator[Callable[[dict[str, str]], TestClient]]:
    """Build API clients that share the test's session, so requests roll back.

    A factory rather than one client, because a test may need two callers at
    once - an administrator and a stranger, say - and they must not share a
    set of headers. The session override is installed once and removed when
    the test ends, however many clients were built.
    """
    from app.core.db import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: session
    clients: list[TestClient] = []

    def build(headers: dict[str, str]) -> TestClient:
        client = TestClient(app, headers=headers)
        client.__enter__()
        clients.append(client)
        return client

    try:
        yield build
    finally:
        for client in clients:
            client.__exit__(None, None, None)
        app.dependency_overrides.clear()


@pytest.fixture
def anonymous_client(make_client: Callable[[dict[str, str]], TestClient]) -> TestClient:
    """An API client that presents no token.

    Use this to assert that an endpoint refuses an unauthenticated caller;
    everything else wants `client` or `client_as`.
    """
    return make_client({})


@pytest.fixture
def headers_for() -> Callable[[str], dict[str, str]]:
    """Build the Authorization header a given person would send.

    A real token through the real verification path, minted by development
    mode rather than stubbed, so tests exercise what production runs.
    """
    from app.core.security import issue_dev_token

    def build(email: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {issue_dev_token(email)}"}

    return build


@pytest.fixture
def client_as(
    make_client: Callable[[dict[str, str]], TestClient],
    headers_for: Callable[[str], dict[str, str]],
) -> Callable[[str], TestClient]:
    """A factory for a client authenticated as a given email.

    Each call returns its own client, so two identities in one test do not
    overwrite each other's credentials.
    """

    def as_person(email: str) -> TestClient:
        return make_client(headers_for(email))

    return as_person


@pytest.fixture
def client(client_as: Callable[[str], TestClient]) -> TestClient:
    """An API client authenticated as an administrator.

    The default actor because most of what the suite exercises - registering
    a team, naming its leader, managing membership - is an administrator's to
    do. Tests about who may do what name their actor with `client_as` instead,
    and tests about refusing an unauthenticated caller use `anonymous_client`.
    """
    return client_as(ADMIN_EMAIL)
