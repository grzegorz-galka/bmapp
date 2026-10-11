"""Metric, threshold and correction events are logged at INFO with ids and the acting email only."""

import datetime
import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, add_threshold, freeze_today, record
from tests.integration.teams_api import add, member_id, register

OWNER = "owner@example.com"


def _messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    """The application's own INFO messages, without the test client's request lines."""
    return [
        r.getMessage()
        for r in caplog.records
        if r.levelno == logging.INFO and r.name.startswith("app.")
    ]


def test_adding_changing_retiring_and_deleting_a_metric_are_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    team = register(client)
    owner = member_id(add(client, team["id"], OWNER), OWNER)
    with caplog.at_level(logging.INFO):
        metric = add_metric(client, team["id"], owner_employee_id=owner)
        url = f"/teams/{team['id']}/metrics/{metric['id']}"
        client.patch(url, json={"name": "Sales"})
        client.patch(url, json={"retired": True})
        client.patch(url, json={"retired": False})
        client.delete(url)

    prefix = f"Metric {metric['id']} of team {team['id']}"
    assert _messages(caplog)[-7:] == [
        f"{prefix} added by {ADMIN_EMAIL}",
        f"{prefix} changed by {ADMIN_EMAIL}",
        f"{prefix} changed by {ADMIN_EMAIL}",
        f"{prefix} retired by {ADMIN_EMAIL}",
        f"{prefix} changed by {ADMIN_EMAIL}",
        f"{prefix} brought back by {ADMIN_EMAIL}",
        f"{prefix} deleted by {ADMIN_EMAIL}",
    ]
    assert not any(OWNER in message for message in _messages(caplog))


def test_recording_a_threshold_is_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    team = register(client)
    metric = add_metric(client, team["id"])
    with caplog.at_level(logging.INFO):
        version = add_threshold(
            client, team["id"], metric["id"], reason="Secret", green="1", amber="0"
        )

    assert _messages(caplog)[-1] == (
        f"Threshold {version['id']} of metric {metric['id']} of team {team['id']} "
        f"recorded by {ADMIN_EMAIL}"
    )
    # The reason is free text, and could hold anything; the log has no need of it.
    assert "Secret" not in _messages(caplog)[-1]


def test_correcting_a_frozen_value_is_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    team = register(client)
    metric = add_metric(client, team["id"])
    old = open_meeting(client, team["id"], "2026-10-07")
    open_meeting(client, team["id"], "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 10, 15))
    with caplog.at_level(logging.INFO):
        record(client, team["id"], old["id"], metric["id"], value="13", reason="Late invoice")

    assert _messages(caplog)[-1] == (
        f"Value of metric {metric['id']} at meeting {old['id']} of team {team['id']} "
        f"corrected by {ADMIN_EMAIL}"
    )


def test_recording_inside_the_window_is_not_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    with caplog.at_level(logging.INFO):
        record(client, team["id"], meeting["id"], metric["id"], value="1")

    assert not any("Value of metric" in message for message in _messages(caplog))
