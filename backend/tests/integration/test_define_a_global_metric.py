"""One test per scenario of "Define a global metric" in specs/global-metrics/spec.md."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.global_metrics_api import add_global, catalogue
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import add_metric
from tests.integration.teams_api import register


def test_a_global_metric_is_added(client: TestClient) -> None:
    """Scenario: A global metric is added."""
    metric = add_global(
        client, "Service availability", unit="%", decimals=2, direction="higher_is_better"
    )

    uuid.UUID(metric["id"])
    assert {k: v for k, v in metric.items() if k != "id"} == {
        "scope": "global",
        "name": "Service availability",
        "unit": "%",
        "decimals": 2,
        "direction": "higher_is_better",
        "retired": False,
        "threshold": None,
        "boards": 0,
    }
    # It is also listed in the company-wide catalogue, and on no board.
    assert catalogue(client) == [metric]


def test_a_global_metric_name_is_taken(client: TestClient) -> None:
    """Scenario: A global metric name is taken."""
    add_global(client, "Service availability")

    response = client.post(
        "/global-metrics", json={"name": "SERVICE Availability", "direction": "higher_is_better"}
    )

    assert response.status_code == 409
    assert error_of(response) == ("name", "metric_name.duplicate")
    assert [m["name"] for m in catalogue(client)] == ["Service availability"]


@pytest.mark.parametrize(
    ("fields", "field", "code"),
    [
        ({"name": "   "}, "name", "metric_name.blank"),
        ({"unit": "x" * 21}, "unit", "metric_unit.too_long"),
        ({"decimals": 7}, "decimals", "metric_decimals.out_of_range"),
        ({"direction": "sideways"}, "direction", "request.invalid_field"),
    ],
)
def test_invalid_properties_are_refused_as_for_a_boards_metric(
    client: TestClient, fields: dict[str, object], field: str, code: str
) -> None:
    """Scenario: Invalid properties are refused as for a board's metric."""
    body = {"name": "Service availability", "direction": "higher_is_better", **fields}

    response = client.post("/global-metrics", json=body)

    assert response.status_code == 422
    assert error_of(response) == (field, code)
    assert catalogue(client) == []


def test_a_boards_metric_and_a_global_metric_share_a_name(client: TestClient) -> None:
    """Scenario: A board's metric and a global metric share a name."""
    team = register(client)
    add_metric(client, team["id"], "Availability")

    metric = add_global(client, "availability")

    assert [m["id"] for m in catalogue(client)] == [metric["id"]]


def test_a_boards_own_metric_is_not_a_global_metric(client: TestClient) -> None:
    """Not a scenario: the catalogue's routes refuse a board's own metric as absent."""
    team = register(client)
    own = add_metric(client, team["id"], "Availability")
    url = f"/global-metrics/{own['id']}"

    responses = [
        client.patch(url, json={"name": "Uptime"}),
        client.delete(url),
        client.get(f"{url}/thresholds"),
        client.get(f"/global-metrics/{uuid.uuid4()}/thresholds"),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (404, (None, "metric.not_found"))
    ] * 4
    assert catalogue(client) == []
