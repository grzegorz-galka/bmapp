"""One test per scenario of "Arrange a board's layout" in specs/metrics/spec.md."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    groups_of,
    metrics_of,
    placement,
    put_layout,
)
from tests.integration.teams_api import register


def _board(client: TestClient) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """A board with "Quality" holding "Bugs", then "Finance" holding "Revenue", and "Morale"."""
    team = register(client)
    quality = add_group(client, team["id"], "Quality")
    finance = add_group(client, team["id"], "Finance")
    metrics = {
        "Bugs": add_metric(client, team["id"], "Bugs", group_id=quality["id"]),
        "Revenue": add_metric(client, team["id"], "Revenue", group_id=finance["id"]),
        "Morale": add_metric(client, team["id"], "Morale"),
    }
    groups = {"Quality": quality, "Finance": finance}
    return team["id"], groups, {name: m["id"] for name, m in metrics.items()}


def _layout(client: TestClient, team_id: str) -> list[tuple[str, str | None, int]]:
    return [(m["name"], *placement(m)) for m in metrics_of(client, team_id)]


def test_a_metric_is_moved_into_another_group(client: TestClient) -> None:
    """Scenario: A metric is moved into another group."""
    team_id, groups, ids = _board(client)

    response = put_layout(
        client,
        team_id,
        [
            (groups["Quality"]["id"], [ids["Morale"], ids["Bugs"]]),
            (groups["Finance"]["id"], [ids["Revenue"]]),
        ],
        [],
    )

    assert response.status_code == 204
    assert _layout(client, team_id) == [
        ("Morale", "Quality", 0),
        ("Bugs", "Quality", 1),
        ("Revenue", "Finance", 0),
    ]


def test_groups_are_reordered(client: TestClient) -> None:
    """Scenario: Groups are reordered."""
    team_id, groups, ids = _board(client)

    response = put_layout(
        client,
        team_id,
        [
            (groups["Finance"]["id"], [ids["Revenue"]]),
            (groups["Quality"]["id"], [ids["Bugs"]]),
        ],
        [ids["Morale"]],
    )

    assert response.status_code == 204
    assert [(g["name"], g["position"]) for g in groups_of(client, team_id)] == [
        ("Finance", 0),
        ("Quality", 1),
    ]
    assert _layout(client, team_id) == [
        ("Revenue", "Finance", 0),
        ("Bugs", "Quality", 0),
        ("Morale", None, 0),
    ]


@pytest.mark.parametrize(
    "outdated",
    [
        "a metric added since",
        "a group deleted since",
        "a group added since",
        "a metric named twice",
        "a metric of another board",
    ],
)
def test_a_layout_made_against_an_outdated_board(client: TestClient, outdated: str) -> None:
    """Scenario: A layout made against an outdated board."""
    team_id, groups, ids = _board(client)
    quality, finance = groups["Quality"]["id"], groups["Finance"]["id"]
    layout = [(quality, [ids["Bugs"]]), (finance, [ids["Revenue"]])]
    ungrouped = [ids["Morale"]]
    if outdated == "a metric added since":
        add_metric(client, team_id, "Incidents")
    elif outdated == "a group deleted since":
        layout.append((str(uuid.uuid4()), []))
    elif outdated == "a group added since":
        add_group(client, team_id, "Delivery")
    elif outdated == "a metric named twice":
        ungrouped.append(ids["Bugs"])
    else:
        other = register(client, "Other", "lead.other@example.com")
        ungrouped.append(add_metric(client, other["id"], "Costs")["id"])
    groups_before, metrics_before = groups_of(client, team_id), metrics_of(client, team_id)

    response = put_layout(client, team_id, layout, ungrouped)

    assert response.status_code == 409
    assert error_of(response) == (None, "metric_layout.stale")
    assert groups_of(client, team_id) == groups_before
    assert metrics_of(client, team_id) == metrics_before


def test_a_retired_metric_keeps_its_place_in_the_layout(client: TestClient) -> None:
    team_id, groups, ids = _board(client)
    client.patch(f"/teams/{team_id}/metrics/{ids['Bugs']}", json={"retired": True})
    layout = [(groups["Quality"]["id"], []), (groups["Finance"]["id"], [ids["Revenue"]])]

    left_out = put_layout(client, team_id, layout, [ids["Morale"]])
    named = put_layout(client, team_id, layout, [ids["Bugs"], ids["Morale"]])

    assert (left_out.status_code, named.status_code) == (409, 204)
    assert _layout(client, team_id)[-2:] == [("Bugs", None, 0), ("Morale", None, 1)]


def test_the_layout_of_a_team_that_does_not_exist(client: TestClient) -> None:
    response = put_layout(client, str(uuid.uuid4()), [], [])

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
