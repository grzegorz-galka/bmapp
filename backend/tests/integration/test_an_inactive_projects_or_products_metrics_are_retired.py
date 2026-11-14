"""One test per scenario of "An inactive project's or product's metrics are retired".

In specs/projects-and-products/spec.md. Every reader that decides whether a
placement is active - the board's tiles and completeness, the owing count,
the dashboard row and recording - is checked against the one predicate.
Today is pinned to Monday 12 October 2026; the next meeting is on the
Wednesday after.
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import dashboard_of, freeze_today
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_threshold,
    board_of,
    metrics_of,
    put_value,
    record,
    thresholds_of,
    trend_of,
)
from tests.integration.project_metrics_api import add_metric_of, change_metric, set_active
from tests.integration.projects_api import add_product, add_project
from tests.integration.pulse_api import answer
from tests.integration.teams_api import LEADER_EMAIL, add, register

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]

ANNA = "anna@example.com"


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def _shown_ids(board: Any) -> list[str]:
    """The metrics the board draws a tile for: active and not hidden."""
    return [entry["metric"]["id"] for entry in board["metrics"] if not entry["metric"]["hidden"]]


def test_deactivating_stops_the_chase(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Deactivating stops the chase."""
    team = add(client, register(client)["id"], ANNA)
    project = add_project(client, team["id"], code="PRJ-042", manager_email=ANNA)
    budget = add_metric_of(client, team["id"], project_id=project["id"], hidden=False)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    # Everyone has answered the pulse check, so only the metric is owed.
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])
    answer(client_as(ANNA), team["id"], meeting["id"])
    assert budget["owner"]["email"] == ANNA
    before = board_of(client, team["id"], meeting["id"])
    assert _shown_ids(before) == [budget["id"]]
    assert [m["metric_id"] for m in before["completeness"]["missing"]] == [budget["id"]]
    assert before["completeness"]["owing"] == 1
    (row,) = dashboard_of(client_as(ANNA))["meetings"]
    assert (row["recorded"], row["total"], row["owing"]) == (0, 1, 1)

    set_active(client, team["id"], "projects", project["id"], False)

    after = board_of(client, team["id"], meeting["id"])
    assert after["metrics"] == []
    assert after["completeness"] == {"recorded": 0, "total": 0, "missing": [], "owing": 0}
    (row,) = dashboard_of(client_as(ANNA))["meetings"]
    assert (row["recorded"], row["total"], row["owing"]) == (0, 0, 0)


def test_a_value_for_an_inactive_projects_metric_is_refused(client: TestClient) -> None:
    """Scenario: A value for an inactive project's metric is refused."""
    team = register(client)
    project = add_project(client, team["id"])
    product = add_product(client, team["id"])
    budget = add_metric_of(client, team["id"], project_id=project["id"])
    nps = add_metric_of(client, team["id"], "NPS", product_id=product["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")
    set_active(client, team["id"], "projects", project["id"], False)
    set_active(client, team["id"], "products", product["id"], False)

    to_project = put_value(client, team["id"], meeting["id"], budget["id"], value="40")
    to_product = put_value(client, team["id"], meeting["id"], nps["id"], value="40")

    assert to_project.status_code == to_product.status_code == 409
    assert error_of(to_project) == (None, "metric.retired")
    assert error_of(to_product) == (None, "metric.retired")
    assert [p["value"] for p in trend_of(client, team["id"], budget["id"])["points"]] == [None]
    assert [p["value"] for p in trend_of(client, team["id"], nps["id"])["points"]] == [None]


def test_history_stays_readable(client: TestClient) -> None:
    """Scenario: History stays readable."""
    team = register(client)
    project = add_project(client, team["id"])
    budget = add_metric_of(client, team["id"], project_id=project["id"])
    add_threshold(
        client, team["id"], budget["id"], target_value="100", green_pct="0", amber_pct="10"
    )
    meeting = open_meeting(client, team["id"], "2026-10-14")
    record(client, team["id"], meeting["id"], budget["id"], value="104")

    set_active(client, team["id"], "projects", project["id"], False)

    trend = trend_of(client, team["id"], budget["id"])
    assert [(p["value"], p["status"]) for p in trend["points"]] == [("104", "amber")]
    assert (trend["metric"]["retired"], trend["metric"]["project"]["active"]) == (True, False)
    assert [v["target_value"] for v in thresholds_of(client, team["id"], budget["id"])] == ["100"]
    (listed,) = metrics_of(client, team["id"])
    assert (listed["retired"], listed["threshold"]["target_value"]) == (True, "100")


def test_reactivating_restores_the_metrics(client: TestClient) -> None:
    """Scenario: Reactivating restores the metrics."""
    team = register(client)
    project = add_project(client, team["id"])
    shown = add_metric_of(client, team["id"], "Shown", project_id=project["id"], hidden=False)
    hidden = add_metric_of(client, team["id"], "Hidden", project_id=project["id"])
    retired = add_metric_of(client, team["id"], "Retired", project_id=project["id"], hidden=False)
    change_metric(client, team["id"], retired["id"], retired=True)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    set_active(client, team["id"], "projects", project["id"], False)
    assert board_of(client, team["id"], meeting["id"])["metrics"] == []

    set_active(client, team["id"], "projects", project["id"], True)

    board = board_of(client, team["id"], meeting["id"])
    assert {e["metric"]["id"]: e["metric"]["hidden"] for e in board["metrics"]} == {
        shown["id"]: False,
        hidden["id"]: True,
    }
    assert _shown_ids(board) == [shown["id"]]
    listed = {m["id"]: (m["retired"], m["hidden"]) for m in metrics_of(client, team["id"])}
    assert listed == {
        shown["id"]: (False, False),
        hidden["id"]: (False, True),
        retired["id"]: (True, False),
    }
    record(client, team["id"], meeting["id"], shown["id"], value="1")
