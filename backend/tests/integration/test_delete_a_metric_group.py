"""One test per scenario of "Delete a metric group" in specs/metrics/spec.md."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    add_threshold,
    freeze_today,
    groups_of,
    metrics_of,
    placement,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.teams_api import register


def test_a_group_with_metrics_is_deleted(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A group with metrics is deleted."""
    freeze_today(monkeypatch)
    team = register(client)
    finance = add_group(client, team["id"], "Finance")
    quality = add_group(client, team["id"], "Quality")
    delivery = add_group(client, team["id"], "Delivery")
    add_metric(client, team["id"], "Morale")
    bugs = add_metric(client, team["id"], "Bugs", group_id=quality["id"])
    add_metric(client, team["id"], "Defects", group_id=quality["id"])
    add_threshold(client, team["id"], bugs["id"], green="10", amber="5")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], bugs["id"], value="3")

    response = client.delete(f"/teams/{team['id']}/metric-groups/{quality['id']}")

    assert response.status_code == 204
    assert [(g["name"], g["position"]) for g in groups_of(client, team["id"])] == [
        (finance["name"], 0),
        (delivery["name"], 1),
    ]
    assert [(m["name"], *placement(m)) for m in metrics_of(client, team["id"])] == [
        ("Morale", None, 0),
        ("Bugs", None, 1),
        ("Defects", None, 2),
    ]
    assert len(thresholds_of(client, team["id"], bugs["id"])) == 1
    assert trend_of(client, team["id"], bugs["id"])["points"][0]["value"] == "3"


def test_an_unknown_group_is_deleted(client: TestClient) -> None:
    """Scenario: An unknown group is deleted."""
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    ours = add_group(client, team["id"], "Quality")
    theirs = add_group(client, other["id"], "Quality")
    metric = add_metric(client, other["id"], "Bugs", group_id=theirs["id"])

    response = client.delete(f"/teams/{team['id']}/metric-groups/{theirs['id']}")

    assert response.status_code == 404
    assert error_of(response) == (None, "metric_group.not_found")
    assert groups_of(client, team["id"]) == [ours]
    assert groups_of(client, other["id"]) == [theirs]
    assert metrics_of(client, other["id"]) == [metric]
