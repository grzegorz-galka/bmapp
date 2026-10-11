"""One test per scenario of "Define a metric on a board" in specs/metrics/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric, metrics_of
from tests.integration.teams_api import add, member_id, register

MEMBER = "member@example.com"


def test_a_metric_is_added(client: TestClient) -> None:
    """Scenario: A metric is added."""
    team = register(client)

    metric = add_metric(
        client,
        team["id"],
        "Revenue",
        unit="mln zł",
        decimals=1,
        direction="higher_is_better",
        group_label="Finance",
    )

    uuid.UUID(metric["id"])
    assert {k: metric[k] for k in ("name", "unit", "decimals", "direction", "group_label")} == {
        "name": "Revenue",
        "unit": "mln zł",
        "decimals": 1,
        "direction": "higher_is_better",
        "group_label": "Finance",
    }
    assert (metric["threshold"], metric["retired"], metric["team_id"]) == (None, False, team["id"])


@pytest.mark.parametrize(
    ("name", "status", "code"),
    [
        ("   ", 422, "metric_name.blank"),
        ("x" * 201, 422, "metric_name.too_long"),
        ("REVENUE", 409, "metric_name.duplicate"),
    ],
)
def test_name_is_blank_too_long_or_taken(
    client: TestClient, name: str, status: int, code: str
) -> None:
    """Scenario: Name is blank, too long or taken."""
    team = register(client)
    add_metric(client, team["id"], "Revenue")

    response = client.post(
        f"/teams/{team['id']}/metrics", json={"name": name, "direction": "higher_is_better"}
    )

    assert response.status_code == status
    assert error_of(response) == ("name", code)
    assert len(metrics_of(client, team["id"])) == 1


def test_two_boards_use_the_same_metric_name(client: TestClient) -> None:
    """Scenario: Two boards use the same metric name."""
    alpha = register(client, "Alpha", "lead.alpha@example.com")
    beta = register(client, "Beta", "lead.beta@example.com")

    add_metric(client, alpha["id"], "Revenue")
    add_metric(client, beta["id"], "Revenue")

    assert [m["name"] for m in metrics_of(client, beta["id"])] == ["Revenue"]


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({"unit": "x" * 21}, ("unit", "metric_unit.too_long")),
        ({"decimals": 7}, ("decimals", "metric_decimals.out_of_range")),
    ],
)
def test_unit_or_decimals_out_of_bounds(
    client: TestClient, fields: dict[str, object], expected: tuple[str, str]
) -> None:
    """Scenario: Unit or decimals out of bounds."""
    team = register(client)

    response = client.post(
        f"/teams/{team['id']}/metrics",
        json={"name": "Revenue", "direction": "higher_is_better", **fields},
    )

    assert response.status_code == 422
    assert error_of(response) == expected


def test_owner_outside_the_team(client: TestClient) -> None:
    """Scenario: Owner outside the team."""
    team = register(client, "Alpha", "lead.alpha@example.com")
    other = register(client, "Beta", "lead.beta@example.com")
    outsider = member_id(add(client, other["id"], MEMBER), MEMBER)

    response = client.post(
        f"/teams/{team['id']}/metrics",
        json={"name": "Revenue", "direction": "higher_is_better", "owner_employee_id": outsider},
    )

    assert response.status_code == 409
    assert error_of(response) == ("owner_employee_id", "metric_owner.not_member")
    assert metrics_of(client, team["id"]) == []


def test_a_member_is_named_owner(client: TestClient) -> None:
    team = register(client)
    owner = member_id(add(client, team["id"], MEMBER), MEMBER)

    metric = add_metric(client, team["id"], owner_employee_id=owner)

    assert metric["owner"] == {"id": owner, "email": MEMBER}


def test_unknown_direction(client: TestClient) -> None:
    """Scenario: Unknown direction."""
    team = register(client)

    response = client.post(
        f"/teams/{team['id']}/metrics", json={"name": "Revenue", "direction": "sideways"}
    )

    assert response.status_code == 422
    assert error_of(response) == ("direction", "request.invalid_field")


def test_a_team_that_does_not_exist(client: TestClient) -> None:
    response = client.post(
        f"/teams/{uuid.uuid4()}/metrics", json={"name": "Revenue", "direction": "within_band"}
    )

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
