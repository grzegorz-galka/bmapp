"""The unhealthy path, exercised without stopping a real database."""

from typing import Any

from sqlalchemy.exc import OperationalError

from app.api.health import get_health


class _UnreachableSession:
    """Stands in for a session whose database has gone away."""

    def execute(self, *_: Any, **__: Any) -> None:
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))


class _Response:
    status_code: int = 200


def test_reports_unhealthy_when_the_database_is_unreachable() -> None:
    response = _Response()

    health = get_health(response, _UnreachableSession())  # type: ignore[arg-type]

    assert health.status == "unhealthy"
    assert health.database == "unreachable"
    assert response.status_code == 503
