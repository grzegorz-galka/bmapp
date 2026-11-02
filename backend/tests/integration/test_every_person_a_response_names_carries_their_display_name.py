"""One test per scenario of "Every person a response names carries their display name"
in specs/team-membership/spec.md, and one for the people a plain email column names
(design D7)."""

import datetime
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.conftest import ADMIN_EMAIL
from tests.integration.dashboard_api import freeze_today
from tests.integration.items_api import items_of, raise_problem, raise_task
from tests.integration.meetings_api import meetings_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    board_of,
    put_value,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.pulse_api import answer, results_of
from tests.integration.teams_api import add, member_id, register

pytestmark = pytest.mark.integration

HOST = "jan.kowalski@example.com"
NAMED = "grzegorz.galka@pse.pl"
SILENT = "anna.maria.nowak@example.com"


def _store_name(session: Session, email: str, name: str | None, surname: str | None) -> None:
    session.execute(
        sa.update(Employee).where(Employee.email == email).values(name=name, surname=surname)
    )
    session.commit()


def _team(client: TestClient, *emails: str) -> Any:
    team = register(client)
    for email in emails:
        team = add(client, team["id"], email)
    return team


def test_a_meetings_host_carries_a_display_name(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A meeting's host carries a display name."""
    team = _team(client, HOST)
    host = member_id(team, HOST)
    response = client.post(
        f"/teams/{team['id']}/meetings",
        json={"date": "2026-10-14", "time": "13:00", "host_employee_id": host},
    )
    assert response.status_code == 201, response.json()

    [listed] = meetings_of(client, team["id"])["meetings"]

    assert response.json()["host"] == {"id": host, "email": HOST, "display_name": "Jan Kowalski"}
    assert listed["host"] == response.json()["host"]
    freeze_today(monkeypatch)
    assert board_of(client, team["id"], listed["id"])["meeting"]["host"]["display_name"] == (
        "Jan Kowalski"
    )


def test_a_responsible_member_carries_a_stored_name(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A responsible member carries a stored name."""
    freeze_today(monkeypatch)
    team = _team(client, NAMED)
    _store_name(session, NAMED, "Grzegorz", "Gałka")
    responsible = member_id(team, NAMED)

    problem = raise_problem(client, team["id"], responsible_employee_id=responsible)
    task = raise_task(client, team["id"], responsible_employee_id=responsible)

    assert problem["responsible"] == {
        "employee_id": responsible,
        "email": NAMED,
        "display_name": "Grzegorz Gałka",
    }
    assert task["responsible"] == problem["responsible"]
    assert [p["responsible"]["display_name"] for p in items_of(client, team["id"], "problems")] == [
        "Grzegorz Gałka"
    ]


def test_metric_owners_and_pulse_respondents_carry_display_names(
    client: TestClient, client_as: Any, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The owner of a missing metric, who answered the pulse check and who has not."""
    freeze_today(monkeypatch)
    team = _team(client, NAMED, SILENT)
    _store_name(session, NAMED, None, "Gałka")
    add_metric(client, team["id"], "Open bugs", owner_employee_id=member_id(team, SILENT))
    meeting = open_meeting(client, team["id"], "2026-10-14")
    answer(client_as(NAMED), team["id"], meeting["id"])

    [missing] = board_of(client, team["id"], meeting["id"])["completeness"]["missing"]
    pulse = results_of(client, team["id"], meeting["id"])

    assert missing["owner"]["display_name"] == "Anna Maria Nowak"
    assert [(a["email"], a["display_name"]) for a in pulse["answers"]] == [(NAMED, "Gałka")]
    assert [(m["email"], m["display_name"]) for m in pulse["missing"]] == [
        (SILENT, "Anna Maria Nowak"),
        ("lead@example.com", "Lead"),
    ]


def test_a_recorder_with_no_employee_record_is_named_from_the_email(
    client: TestClient, client_as: Any, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Thresholds, values and corrections name whoever recorded them, recorded or not.

    `client` is the administrator, who has no employee record: named from the
    email. A member who records a value is named by what is stored.
    """
    team = _team(client, NAMED)
    _store_name(session, NAMED, "Grzegorz", "Gałka")
    metric = add_metric(client, team["id"])
    threshold = add_threshold(client, team["id"], metric["id"], green="10", amber="5")
    old = open_meeting(client, team["id"], "2026-10-07")
    new = open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    by_admin = record(client, team["id"], old["id"], metric["id"], value="12")
    freeze_today(monkeypatch)
    by_member = record(client_as(NAMED), team["id"], new["id"], metric["id"], value="7")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))
    corrected = put_value(client, team["id"], old["id"], metric["id"], value="13", reason="Late")
    assert corrected.status_code == 200, corrected.json()

    trend = trend_of(client, team["id"], metric["id"])
    [correction] = trend["corrections"]

    assert ADMIN_EMAIL == "admin@pse.pl"
    assert threshold["recorded_by_display_name"] == "Admin"
    assert [
        v["recorded_by_display_name"] for v in thresholds_of(client, team["id"], metric["id"])
    ] == ["Admin"]
    assert by_admin["recorded_by_display_name"] == "Admin"
    assert by_member["recorded_by_display_name"] == "Grzegorz Gałka"
    assert corrected.json()["recorded_by_display_name"] == "Admin"
    assert (correction["corrected_by_email"], correction["corrected_by_display_name"]) == (
        ADMIN_EMAIL,
        "Admin",
    )
    assert {p["threshold"]["recorded_by_display_name"] for p in trend["points"]} == {"Admin"}
