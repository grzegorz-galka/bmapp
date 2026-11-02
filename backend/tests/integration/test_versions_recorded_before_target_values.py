"""One test per scenario of "Versions recorded before target values" in specs/metrics/spec.md.

The earlier version is seeded through the model, as the migration leaves a
version recorded before target values existed: the API takes none like it.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    board_of,
    freeze_today,
    metrics_of,
    record,
    seed_version_before_target_values,
    thresholds_of,
    tile,
)
from tests.integration.teams_api import register


def test_an_earlier_version_is_read(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: An earlier version is read."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    seed_version_before_target_values(
        session, metric["id"], "2026-07-01", green_lo="95", amber_lo="85"
    )
    meeting = open_meeting(client, team["id"], "2026-10-14")

    [version] = thresholds_of(client, team["id"], metric["id"])
    statuses = [
        record(client, team["id"], meeting["id"], metric["id"], value=value)["status"]
        for value in ("96", "95", "90", "85", "84")
    ]

    fields = ("target_value", "green_pct", "amber_pct", "green_lo", "amber_lo")
    assert {k: version[k] for k in fields} == {
        "target_value": None,
        "green_pct": None,
        "amber_pct": None,
        "green_lo": "95",
        "amber_lo": "85",
    }
    assert statuses == ["green", "green", "amber", "amber", "red"]
    [listed] = metrics_of(client, team["id"])
    assert listed["threshold"] == version


def test_a_newer_version_takes_over_on_the_same_date(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A newer version takes over on the same date."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    seed_version_before_target_values(
        session, metric["id"], "2026-10-01", green_lo="95", amber_lo="85"
    )
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], metric["id"], value="88")
    assert tile(board_of(client, team["id"], meeting["id"]), metric["id"])["status"] == "amber"

    newer = add_threshold(
        client,
        team["id"],
        metric["id"],
        "2026-10-01",
        target_value="90",
        green_pct="5",
        amber_pct="10",
    )

    judged = tile(board_of(client, team["id"], meeting["id"]), metric["id"])
    assert (judged["status"], judged["threshold"]) == ("green", newer)
