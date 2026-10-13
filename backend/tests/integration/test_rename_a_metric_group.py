"""One test per scenario of "Rename a metric group" in specs/metrics/spec.md."""

import uuid

from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_group, add_metric, groups_of, metrics_of, placement
from tests.integration.teams_api import register


def test_a_group_is_renamed(client: TestClient) -> None:
    """Scenario: A group is renamed."""
    team = register(client)
    group = add_group(client, team["id"], "Qualty")
    add_metric(client, team["id"], "Bugs", group_id=group["id"])
    add_metric(client, team["id"], "Defects", group_id=group["id"])

    response = client.patch(
        f"/teams/{team['id']}/metric-groups/{group['id']}", json={"name": " Quality "}
    )

    assert response.status_code == 200, response.json()
    assert response.json() == {"id": group["id"], "name": "Quality", "position": 0}
    assert [(m["name"], *placement(m)) for m in metrics_of(client, team["id"])] == [
        ("Bugs", "Quality", 0),
        ("Defects", "Quality", 1),
    ]


def test_renamed_to_a_taken_name(client: TestClient) -> None:
    """Scenario: Renamed to a taken name."""
    team = register(client)
    add_group(client, team["id"], "Quality")
    finance = add_group(client, team["id"], "Finance")
    before = groups_of(client, team["id"])

    response = client.patch(
        f"/teams/{team['id']}/metric-groups/{finance['id']}", json={"name": "quality"}
    )

    assert response.status_code == 409
    assert error_of(response) == ("name", "metric_group_name.duplicate")
    assert groups_of(client, team["id"]) == before


def test_a_group_may_be_renamed_to_its_own_name_in_another_case(client: TestClient) -> None:
    team = register(client)
    group = add_group(client, team["id"], "quality")

    response = client.patch(
        f"/teams/{team['id']}/metric-groups/{group['id']}", json={"name": "Quality"}
    )

    assert (response.status_code, response.json()["name"]) == (200, "Quality")


def test_renaming_another_boards_group_is_refused(client: TestClient) -> None:
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    theirs = add_group(client, other["id"], "Quality")

    for group_id in (str(uuid.uuid4()), theirs["id"]):
        response = client.patch(
            f"/teams/{team['id']}/metric-groups/{group_id}", json={"name": "Mine"}
        )

        assert response.status_code == 404
        assert error_of(response) == (None, "metric_group.not_found")
    assert groups_of(client, other["id"]) == [theirs]
