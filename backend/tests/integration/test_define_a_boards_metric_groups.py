"""One test per scenario of "Define a board's metric groups" in specs/metrics/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_group, groups_of, metrics_of
from tests.integration.teams_api import register


def test_a_group_is_added(client: TestClient) -> None:
    """Scenario: A group is added."""
    team = register(client)
    finance = add_group(client, team["id"], "Finance")

    quality = add_group(client, team["id"], "  Quality ")

    uuid.UUID(quality["id"])
    assert quality == {"id": quality["id"], "name": "Quality", "position": 1}
    assert groups_of(client, team["id"]) == [finance, quality]
    # It holds no metrics: a group may be empty.
    assert metrics_of(client, team["id"]) == []


@pytest.mark.parametrize(
    ("name", "status", "code"),
    [
        ("   ", 422, "metric_group_name.blank"),
        ("x" * 201, 422, "metric_group_name.too_long"),
        ("QUALITY", 409, "metric_group_name.duplicate"),
    ],
)
def test_group_name_is_blank_too_long_or_taken(
    client: TestClient, name: str, status: int, code: str
) -> None:
    """Scenario: Group name is blank, too long or taken."""
    team = register(client)
    quality = add_group(client, team["id"], "Quality")

    response = client.post(f"/teams/{team['id']}/metric-groups", json={"name": name})

    assert response.status_code == status
    assert error_of(response) == ("name", code)
    assert groups_of(client, team["id"]) == [quality]


def test_two_boards_use_the_same_group_name(client: TestClient) -> None:
    """Scenario: Two boards use the same group name."""
    alpha = register(client, "Alpha", "lead.alpha@example.com")
    beta = register(client, "Beta", "lead.beta@example.com")

    add_group(client, alpha["id"], "Quality")
    add_group(client, beta["id"], "Quality")

    assert [g["name"] for g in groups_of(client, beta["id"])] == ["Quality"]


def test_the_groups_of_a_team_that_does_not_exist(client: TestClient) -> None:
    unknown = uuid.uuid4()

    listed = client.get(f"/teams/{unknown}/metric-groups")
    added = client.post(f"/teams/{unknown}/metric-groups", json={"name": "Quality"})

    assert [(r.status_code, error_of(r)) for r in (listed, added)] == [
        (404, (None, "team.not_found"))
    ] * 2
