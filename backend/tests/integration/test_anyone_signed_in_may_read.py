"""Requirement: Anyone signed in may read."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import register

LEADER = "lead@pse.pl"
#: Authenticated, on no team, and so not a recorded employee at all.
OUTSIDER = "new.hire@pse.pl"


def test_an_authenticated_person_who_belongs_to_no_team_reads_a_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    team = register(client, "Platform", LEADER)

    response = client_as(OUTSIDER).get(f"/teams/{team['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == "Platform"


def test_an_authenticated_person_who_is_not_a_recorded_employee_reads_the_list(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    register(client, "Platform", LEADER)

    response = client_as(OUTSIDER).get("/teams")

    assert response.status_code == 200
    assert [team["name"] for team in response.json()] == ["Platform"]


def test_an_authenticated_person_on_no_team_reads_the_hub(
    client_as: Callable[[str], TestClient],
) -> None:
    response = client_as(OUTSIDER).get("/hub")

    assert response.status_code == 200
    assert response.json()["current_user"]["email"] == OUTSIDER


def test_reading_records_no_employee(
    client_as: Callable[[str], TestClient], session: object
) -> None:
    """Reading must not quietly put the reader on the books."""
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from app.models import Employee

    assert isinstance(session, Session)
    client_as(OUTSIDER).get("/teams")
    session.expire_all()

    recorded = session.scalar(
        select(func.count()).select_from(Employee).where(Employee.email == OUTSIDER)
    )
    assert recorded == 0


@pytest.mark.parametrize("path", ["/teams", "/hub", "/auth/me"])
def test_every_read_still_refuses_a_caller_with_no_token(
    anonymous_client: TestClient, path: str
) -> None:
    """Open to everyone signed in is not open to everyone."""
    response = anonymous_client.get(path)

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"
