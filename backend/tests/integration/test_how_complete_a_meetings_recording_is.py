"""One test per scenario of "How complete a meeting's recording is"
in specs/metric-values/spec.md."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, record
from tests.integration.teams_api import add, member_id, register

OWNER = "owner@example.com"


def test_recording_is_partly_done(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: Recording is partly done."""
    freeze_today(monkeypatch)
    team = register(client)
    owner = member_id(add(client, team["id"], OWNER), OWNER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    metrics = [add_metric(client, team["id"], f"Metric {i:02}") for i in range(12)]
    owned = add_metric(client, team["id"], "Owned", owner_employee_id=owner)
    unowned = add_metric(client, team["id"], "Unowned")
    for metric in metrics:
        record(client, team["id"], meeting["id"], metric["id"], value="1")
    # A comment alone is not a number.
    record(client, team["id"], meeting["id"], unowned["id"], comment="Waiting for data")

    completeness = board_of(client, team["id"], meeting["id"])["completeness"]

    assert (completeness["recorded"], completeness["total"]) == (12, 14)
    assert completeness["missing"] == [
        {"metric_id": owned["id"], "name": "Owned", "owner": {"id": owner, "email": OWNER}},
        {"metric_id": unowned["id"], "name": "Unowned", "owner": None},
    ]
