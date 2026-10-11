"""Requirement: Only an administrator corrects a frozen value."""

import datetime
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    put_value,
    record,
    tile,
    trend_of,
)
from tests.integration.teams_api import register

LEADER = "lead@pse.pl"


@pytest.fixture
def frozen(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, str, str]:
    """A value of 12 at the 7.10 meeting, frozen since the team met again on 14.10."""
    team = register(client, "Platform", LEADER)
    metric = add_metric(client, team["id"])
    old = open_meeting(client, team["id"], "2026-10-07")
    open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 8))
    record(client, team["id"], old["id"], metric["id"], value="12")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))
    return team["id"], old["id"], metric["id"]


def test_a_leader_cannot_correct_a_frozen_value(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    frozen: tuple[str, str, str],
) -> None:
    """Scenario: A leader cannot correct a frozen value."""
    response = put_value(client_as(LEADER), *frozen, value="13", reason="Late invoice")

    assert response.status_code == 409
    assert error_of(response) == (None, "metric_value.meeting_frozen")
    assert tile(board_of(client, frozen[0], frozen[1]), frozen[2])["value"] == "12"


def test_an_administrator_corrects_a_frozen_value(
    client: TestClient, frozen: tuple[str, str, str]
) -> None:
    """Scenario: An administrator corrects a frozen value."""
    response = put_value(client, *frozen, value="13", reason="Late invoice")

    assert response.status_code == 200
    assert response.json()["value"] == "13"
    assert len(trend_of(client, frozen[0], frozen[2])["corrections"]) == 1
