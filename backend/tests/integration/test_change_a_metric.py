"""One test per scenario of "Change a metric" in specs/metrics/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    add_threshold,
    freeze_today,
    metrics_of,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"


def test_a_metric_is_renamed_and_regrouped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A metric is renamed and regrouped."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], "Revenue", group_label="Finance")
    add_threshold(client, team["id"], metric["id"], green="95", amber="85")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], metric["id"], value="96")

    response = client.patch(
        f"/teams/{team['id']}/metrics/{metric['id']}",
        json={"name": "Sales", "group_label": "Commercial"},
    )

    assert response.status_code == 200
    changed = response.json()
    assert (changed["name"], changed["group_label"], changed["id"]) == (
        "Sales",
        "Commercial",
        metric["id"],
    )
    assert changed["threshold"]["green_lo"] == "95"
    assert len(thresholds_of(client, team["id"], metric["id"])) == 1
    assert trend_of(client, team["id"], metric["id"])["points"][0]["value"] == "96"


def test_changing_the_direction_is_refused(client: TestClient) -> None:
    """Scenario: Changing the direction is refused."""
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")

    response = client.patch(
        f"/teams/{team['id']}/metrics/{metric['id']}",
        json={"direction": "lower_is_better", "name": "Renamed"},
    )

    assert response.status_code == 409
    assert error_of(response) == ("direction", "metric_direction.immutable")
    assert metrics_of(client, team["id"])[0] == metric


def test_repeating_the_direction_is_not_a_change(client: TestClient) -> None:
    team = register(client)
    metric = add_metric(client, team["id"], direction="within_band")

    response = client.patch(
        f"/teams/{team['id']}/metrics/{metric['id']}", json={"direction": "within_band"}
    )

    assert response.status_code == 200


def test_owner_and_group_are_set_and_cleared(client: TestClient) -> None:
    team = register(client)
    owner = member_id(add(client, team["id"], MEMBER), MEMBER)
    metric = add_metric(client, team["id"], group_label="Finance")
    url = f"/teams/{team['id']}/metrics/{metric['id']}"

    owned = client.patch(url, json={"owner_employee_id": owner}).json()
    cleared = client.patch(url, json={"owner_employee_id": None, "group_label": None}).json()

    assert owned["owner"] == {"id": owner, "email": MEMBER}
    assert (cleared["owner"], cleared["group_label"]) == (None, None)


def test_a_change_follows_the_rules_for_defining_one(client: TestClient) -> None:
    team = register(client)
    add_metric(client, team["id"], "Revenue")
    other = add_metric(client, team["id"], "Costs")
    url = f"/teams/{team['id']}/metrics/{other['id']}"

    duplicate = client.patch(url, json={"name": "revenue"})
    stranger = client.patch(url, json={"owner_employee_id": str(uuid.uuid4())})

    assert error_of(duplicate) == ("name", "metric_name.duplicate")
    assert error_of(stranger) == ("owner_employee_id", "metric_owner.not_member")
    assert metrics_of(client, team["id"])[0]["name"] == "Costs"


def test_the_metric_does_not_exist(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    theirs = add_metric(client, other["id"])

    for metric_id in (str(uuid.uuid4()), theirs["id"]):
        response = client.patch(f"/teams/{team['id']}/metrics/{metric_id}", json={"name": "X"})

        assert response.status_code == 404
        assert error_of(response) == (None, "metric.not_found")
