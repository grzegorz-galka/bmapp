"""One test per scenario of "Problem and task events are logged"
in specs/problems-and-tasks/spec.md."""

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL
from tests.integration.items_api import change, freeze_today, raise_problem, raise_task
from tests.integration.teams_api import register

SECRETS = ("Anna Kowalska keeps breaking the build", "Fire the contractor", "Ask Jan to stay late")


def _info(caplog: pytest.LogCaptureFixture) -> list[str]:
    """The application's own INFO messages, without the test client's request lines."""
    return [
        r.getMessage()
        for r in caplog.records
        if r.levelno == logging.INFO and r.name.startswith("app.")
    ]


def test_closing_is_logged_without_the_texts(
    client: TestClient, caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Closing is logged without the texts."""
    freeze_today(monkeypatch)
    team = register(client)
    reason, solution, details = SECRETS

    with caplog.at_level(logging.DEBUG):
        problem = raise_problem(client, team["id"], reason, reason=reason, solution=solution)
        change(client, team["id"], "problems", problem["id"], stage="do")
        change(client, team["id"], "problems", problem["id"], stage="act")
        task = raise_task(client, team["id"], details, details=details, stage="act")

    prefix = f"of team {team['id']}"
    assert _info(caplog)[-6:] == [
        f"Problem {problem['id']} {prefix} raised by {ADMIN_EMAIL}",
        f"Problem {problem['id']} {prefix} moved to do by {ADMIN_EMAIL}",
        f"Problem {problem['id']} {prefix} moved to act by {ADMIN_EMAIL}",
        f"Problem {problem['id']} {prefix} closed by {ADMIN_EMAIL}",
        f"Task {task['id']} {prefix} raised by {ADMIN_EMAIL}",
        f"Task {task['id']} {prefix} closed by {ADMIN_EMAIL}",
    ]
    every_message = [r.getMessage() for r in caplog.records if r.name.startswith("app.")]
    assert not any(secret in message for message in every_message for secret in SECRETS)
