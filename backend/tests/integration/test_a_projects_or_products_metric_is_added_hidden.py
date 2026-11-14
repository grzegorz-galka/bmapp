"""One test per scenario of "A project's or product's metric is added hidden".

In specs/projects-and-products/spec.md. Today is pinned to Monday 12
October 2026; the next meeting is on the Wednesday after.
"""

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    board_of,
    freeze_today,
    metrics_of,
    placement,
    put_layout,
    record,
    tile,
)
from tests.integration.project_metrics_api import add_metric_of, change_metric
from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_a_projects_metric_has_no_tile_at_first(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A project's metric has no tile at first."""
    freeze_today(monkeypatch)
    team = register(client)
    project = add_project(client, team["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    metric = add_metric_of(client, team["id"], project_id=project["id"])
    value = record(client, team["id"], meeting["id"], metric["id"], value="40")

    assert metric["hidden"] is True
    entry = tile(board_of(client, team["id"], meeting["id"]), metric["id"])
    # The board returns it marked hidden, for the recording view; it draws no tile.
    assert (entry["metric"]["hidden"], entry["value"]) == (True, "40")
    assert value["value"] == "40"


def test_a_products_metric_is_shown_when_asked(client: TestClient) -> None:
    """Asked to show it, a product's metric arrives shown; a board's own one is shown anyway."""
    team = register(client)
    product = add_product(client, team["id"])

    shown = add_metric_of(client, team["id"], "NPS", product_id=product["id"], hidden=False)
    hidden = add_metric_of(client, team["id"], "Churn", product_id=product["id"])
    own = add_metric(client, team["id"], "Lead time")

    assert (shown["hidden"], hidden["hidden"], own["hidden"]) == (False, True, False)


def test_a_projects_metric_is_shown_as_a_tile(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A project's metric is shown as a tile."""
    freeze_today(monkeypatch)
    team = register(client)
    project = add_project(client, team["id"])
    delivery = add_group(client, team["id"], "Delivery")
    lead_time = add_metric(client, team["id"], "Lead time", group_id=delivery["id"])
    metric = add_metric_of(client, team["id"], project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    change_metric(client, team["id"], metric["id"], hidden=False, group_id=delivery["id"])
    response = put_layout(
        client, team["id"], [(delivery["id"], [metric["id"], lead_time["id"]])], []
    )

    assert response.status_code == 204, response.json()
    entry = tile(board_of(client, team["id"], meeting["id"]), metric["id"])
    assert entry["metric"]["hidden"] is False
    assert placement(entry["metric"]) == ("Delivery", 0)
    listed = {m["id"]: placement(m) for m in metrics_of(client, team["id"])}
    assert listed == {metric["id"]: ("Delivery", 0), lead_time["id"]: ("Delivery", 1)}
