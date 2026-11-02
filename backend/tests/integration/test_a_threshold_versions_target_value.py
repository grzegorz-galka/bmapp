"""One test per scenario of "A threshold version's target value" in specs/metrics/spec.md."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import add_metric, freeze_today, record, thresholds_of
from tests.integration.teams_api import register


def _post(client: TestClient, team_id: str, metric_id: str, **body: object) -> Any:
    return client.post(
        f"/teams/{team_id}/metrics/{metric_id}/thresholds",
        json={"effective_from": "2026-11-01", "reason": "Plan for 2027", **body},
    )


def _refused(
    client: TestClient, direction: str, body: dict[str, str]
) -> tuple[tuple[str | None, str], Any]:
    """Post a version that should be refused; the field and code, and the history after."""
    team = register(client)
    metric = add_metric(client, team["id"], direction=direction)

    response = _post(client, team["id"], metric["id"], **body)

    assert response.status_code == 422
    return error_of(response), thresholds_of(client, team["id"], metric["id"])


def test_a_version_with_a_target_value_and_tolerances(client: TestClient) -> None:
    """Scenario: A version with a target value and tolerances."""
    team = register(client)
    metric = add_metric(client, team["id"], direction="within_band")

    response = _post(
        client, team["id"], metric["id"], target_value="72.3", green_pct="5", amber_pct="10"
    )

    assert response.status_code == 201
    version = response.json()
    fields = ("effective_from", "reason", "target_value", "green_pct", "amber_pct")
    assert {k: version[k] for k in fields} == {
        "effective_from": "2026-11-01",
        "reason": "Plan for 2027",
        "target_value": "72.3",
        "green_pct": "5",
        "amber_pct": "10",
    }
    bounds = ("green_lo", "green_hi", "amber_lo", "amber_hi")
    assert {k: version[k] for k in bounds} == {
        "green_lo": "68.685",
        "green_hi": "75.915",
        "amber_lo": "65.07",
        "amber_hi": "79.53",
    }
    assert thresholds_of(client, team["id"], metric["id"]) == [version]


def test_a_version_with_the_target_value_0_and_a_range(client: TestClient) -> None:
    """Scenario: A version with the target value 0 and a range."""
    team = register(client)
    metric = add_metric(client, team["id"], direction="lower_is_better")

    response = _post(client, team["id"], metric["id"], target_value="0", green="5", amber="10")

    assert response.status_code == 201
    version = response.json()
    fields = ("target_value", "green_pct", "amber_pct", "green_hi", "amber_hi")
    assert {k: version[k] for k in fields} == {
        "target_value": "0",
        "green_pct": None,
        "amber_pct": None,
        "green_hi": "5",
        "amber_hi": "10",
    }
    assert (version["green_lo"], version["amber_lo"]) == (None, None)


def test_the_target_value_is_missing(client: TestClient) -> None:
    """Scenario: The target value is missing."""
    error, history = _refused(client, "higher_is_better", {"green_pct": "5", "amber_pct": "10"})

    assert error == ("target_value", "request.invalid_field")
    assert history == []


def test_tolerances_where_the_target_value_is_0(client: TestClient) -> None:
    """Scenario: Tolerances where the target value is 0."""
    error, history = _refused(
        client,
        "lower_is_better",
        {"target_value": "0", "green_pct": "5", "green": "5", "amber": "10"},
    )

    assert error == ("green_pct", "request.invalid_field")
    assert history == []


@pytest.mark.parametrize(
    ("direction", "boundary"),
    [("higher_is_better", "green"), ("within_band", "green_lo")],
)
def test_boundaries_where_the_target_value_is_not_0(
    client: TestClient, direction: str, boundary: str
) -> None:
    """Scenario: Boundaries where the target value is not 0."""
    body = {"target_value": "95", "green_pct": "5", "amber_pct": "10", boundary: "95"}

    error, history = _refused(client, direction, body)

    assert error == (boundary, "request.invalid_field")
    assert history == []


def test_a_tolerance_is_missing(client: TestClient) -> None:
    """Scenario: A tolerance is missing."""
    error, history = _refused(client, "higher_is_better", {"target_value": "95", "green_pct": "5"})

    assert error == ("amber_pct", "request.invalid_field")
    assert history == []


def test_a_negative_tolerance(client: TestClient) -> None:
    """Scenario: A negative tolerance."""
    error, history = _refused(
        client, "higher_is_better", {"target_value": "95", "green_pct": "-1", "amber_pct": "5"}
    )

    assert error == ("green_pct", "threshold_tolerance.negative")
    assert history == []


def test_amber_tighter_than_green(client: TestClient) -> None:
    """Scenario: Amber tighter than green."""
    error, history = _refused(
        client, "higher_is_better", {"target_value": "95", "green_pct": "10", "amber_pct": "5"}
    )

    assert error == (None, "threshold.order_invalid")
    assert history == []


def test_equal_tolerances_make_a_plain_red_and_green_metric(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Equal tolerances make a plain red-and-green metric."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], direction="higher_is_better")
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = client.post(
        f"/teams/{team['id']}/metrics/{metric['id']}/thresholds",
        json={
            "effective_from": "2026-10-01",
            "reason": "Plan",
            "target_value": "100",
            "green_pct": "0",
            "amber_pct": "0",
        },
    )

    assert response.status_code == 201
    statuses = [
        record(client, team["id"], meeting["id"], metric["id"], value=value)["status"]
        for value in ("100", "99.999999", "120")
    ]
    assert statuses == ["green", "red", "green"]
