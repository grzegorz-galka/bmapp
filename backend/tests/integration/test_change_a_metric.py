"""One test per scenario of "Change a metric" in specs/metrics/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    add_threshold,
    freeze_today,
    metrics_of,
    placement,
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
    finance = add_group(client, team["id"], "Finance")
    commercial = add_group(client, team["id"], "Commercial")
    add_metric(client, team["id"], "Orders", group_id=commercial["id"])
    metric = add_metric(client, team["id"], "Revenue", group_id=finance["id"])
    add_threshold(client, team["id"], metric["id"], green="95", amber="85")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], metric["id"], value="96")

    response = client.patch(
        f"/teams/{team['id']}/metrics/{metric['id']}",
        json={"name": "Sales", "group_id": commercial["id"]},
    )

    assert response.status_code == 200
    changed = response.json()
    assert (changed["name"], changed["id"]) == ("Sales", metric["id"])
    assert placement(changed) == ("Commercial", 1)
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
    finance = add_group(client, team["id"], "Finance")
    add_metric(client, team["id"], "Morale")
    metric = add_metric(client, team["id"], group_id=finance["id"])
    url = f"/teams/{team['id']}/metrics/{metric['id']}"

    owned = client.patch(url, json={"owner_employee_id": owner}).json()
    cleared = client.patch(url, json={"owner_employee_id": None, "group_id": None}).json()

    assert owned["owner"] == {"id": owner, "email": MEMBER}
    assert placement(owned) == ("Finance", 0)
    # Out of every group: last among the ungrouped metrics.
    assert (cleared["owner"], placement(cleared)) == (None, (None, 1))


def test_moving_to_a_group_of_another_board_is_refused(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    theirs = add_group(client, other["id"], "Quality")
    metric = add_metric(client, team["id"])

    response = client.patch(
        f"/teams/{team['id']}/metrics/{metric['id']}", json={"group_id": theirs["id"]}
    )

    assert response.status_code == 404
    assert error_of(response) == ("group_id", "metric_group.not_found")
    assert metrics_of(client, team["id"]) == [metric]


def test_naming_the_group_it_is_in_keeps_its_place(client: TestClient) -> None:
    team = register(client)
    finance = add_group(client, team["id"], "Finance")
    first = add_metric(client, team["id"], "Revenue", group_id=finance["id"])
    add_metric(client, team["id"], "Costs", group_id=finance["id"])

    response = client.patch(
        f"/teams/{team['id']}/metrics/{first['id']}", json={"group_id": finance["id"]}
    )

    assert placement(response.json()) == ("Finance", 0)


def test_a_change_follows_the_rules_for_defining_one(client: TestClient) -> None:
    team = register(client)
    add_metric(client, team["id"], "Revenue")
    other = add_metric(client, team["id"], "Costs")
    url = f"/teams/{team['id']}/metrics/{other['id']}"

    duplicate = client.patch(url, json={"name": "revenue"})
    stranger = client.patch(url, json={"owner_employee_id": str(uuid.uuid4())})

    assert error_of(duplicate) == ("name", "metric_name.duplicate")
    assert error_of(stranger) == ("owner_employee_id", "metric_owner.not_member")
    assert [m["name"] for m in metrics_of(client, team["id"])] == ["Revenue", "Costs"]


def test_the_metric_does_not_exist(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    theirs = add_metric(client, other["id"])

    for metric_id in (str(uuid.uuid4()), theirs["id"]):
        response = client.patch(f"/teams/{team['id']}/metrics/{metric_id}", json={"name": "X"})

        assert response.status_code == 404
        assert error_of(response) == (None, "metric.not_found")
