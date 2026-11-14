"""One test per scenario of "A project's or product's metric".

In specs/projects-and-products/spec.md. Today is pinned to Monday 12
October 2026; the next meeting is on the Wednesday after.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exceptions import MetricProjectAndProductError
from app.core.metric_enums import Direction
from app.models import Metric
from app.schemas import MetricCreate
from app.services.metrics import add_metric
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_threshold,
    board_of,
    freeze_today,
    metrics_of,
    record,
    tile,
    trend_of,
)
from tests.integration.project_metrics_api import add_metric_of, post_metric_of, set_active
from tests.integration.projects_api import PROJECT, add_product, add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


def test_a_metric_is_added_to_a_project(client: TestClient) -> None:
    """Scenario: A metric is added to a project."""
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")

    metric = add_metric_of(
        client, team["id"], "Budget consumed", project_id=project["id"], unit="%"
    )

    assert {k: metric[k] for k in ("team_id", "scope", "name", "unit", "direction")} == {
        "team_id": team["id"],
        "scope": "board",
        "name": "Budget consumed",
        "unit": "%",
        "direction": "lower_is_better",
    }
    assert metric["project"] == {
        "id": project["id"],
        "code": "PRJ-042",
        "name": PROJECT["name"],
        "active": True,
    }
    assert (metric["product"], metric["threshold"], metric["retired"]) == (None, None, False)
    (listed,) = metrics_of(client, team["id"])
    assert (listed["id"], listed["project"]["code"]) == (metric["id"], "PRJ-042")


def test_a_products_metric_carries_its_product(client: TestClient) -> None:
    """A product's metric is read with the product it belongs to."""
    team = register(client)
    product = add_product(client, team["id"], name="Customer portal")

    metric = add_metric_of(client, team["id"], "NPS", product_id=product["id"])

    assert metric["product"] == {"id": product["id"], "name": "Customer portal", "active": True}
    assert metric["project"] is None


def test_a_projects_metric_takes_a_threshold_version(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A project's metric takes a threshold version."""
    freeze_today(monkeypatch)
    team = register(client)
    project = add_project(client, team["id"])
    metric = add_metric_of(client, team["id"], project_id=project["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    version = add_threshold(
        client,
        team["id"],
        metric["id"],
        target_value="100",
        green_pct="0",
        amber_pct="10",
    )
    value = record(client, team["id"], meeting["id"], metric["id"], value="105")

    assert (version["target_value"], version["green_hi"], version["amber_hi"]) == (
        "100",
        "100",
        "110",
    )
    assert value["status"] == "amber"
    (point,) = trend_of(client, team["id"], metric["id"])["points"]
    assert (point["value"], point["status"]) == ("105", "amber")


def test_the_project_is_another_teams(client: TestClient, session: Session) -> None:
    """Scenario: The project is another team's."""
    mine = register(client, "Platform")
    theirs = register(client, "Quality", "quality-lead@example.com")
    project = add_project(client, theirs["id"])
    product = add_product(client, theirs["id"])

    to_project = post_metric_of(client, mine["id"], project_id=project["id"])
    to_product = post_metric_of(client, mine["id"], product_id=product["id"])

    assert to_project.status_code == 404
    assert error_of(to_project) == ("project_id", "project.not_found")
    assert to_product.status_code == 404
    assert error_of(to_product) == ("product_id", "product.not_found")
    assert session.query(Metric).count() == 0


def test_a_metric_belongs_to_a_project_or_a_product_not_both(
    client: TestClient, session: Session
) -> None:
    """Naming both a project and a product is refused against `project_id`."""
    team = register(client)
    project = add_project(client, team["id"])
    product = add_product(client, team["id"])

    response = post_metric_of(
        client, team["id"], project_id=project["id"], product_id=product["id"]
    )

    assert response.status_code == 422
    assert error_of(response) == ("project_id", "metric.project_and_product")
    assert session.query(Metric).count() == 0
    # A caller that bypasses the request schema meets the same refusal.
    unchecked = MetricCreate.model_construct(
        name="Budget consumed",
        direction=Direction.LOWER_IS_BETTER,
        project_id=uuid.UUID(project["id"]),
        product_id=uuid.UUID(product["id"]),
    )
    with pytest.raises(MetricProjectAndProductError):
        add_metric(session, uuid.UUID(team["id"]), unchecked, "lead@example.com")


def test_a_metric_of_an_inactive_project(client: TestClient) -> None:
    """Scenario: A metric of an inactive project."""
    team = register(client)
    project = add_project(client, team["id"])
    set_active(client, team["id"], "projects", project["id"], False)

    metric = add_metric_of(client, team["id"], project_id=project["id"])

    assert (metric["retired"], metric["project"]["active"]) == (True, False)
    set_active(client, team["id"], "projects", project["id"], True)
    (listed,) = metrics_of(client, team["id"])
    assert (listed["retired"], listed["project"]["active"]) == (False, True)


def test_the_boards_tiles_and_missing_list_carry_the_parent(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The board labels a tile and a missing metric with its project or product."""
    freeze_today(monkeypatch)
    team = register(client)
    project = add_project(client, team["id"], code="PRJ-042")
    product = add_product(client, team["id"], name="Customer portal")
    budget = add_metric_of(client, team["id"], project_id=project["id"], hidden=False)
    nps = add_metric_of(client, team["id"], "NPS", product_id=product["id"])
    meeting = open_meeting(client, team["id"], "2026-10-14")

    board = board_of(client, team["id"], meeting["id"])

    assert tile(board, budget["id"])["metric"]["project"]["code"] == "PRJ-042"
    assert tile(board, nps["id"])["metric"]["product"]["name"] == "Customer portal"
    missing = {m["metric_id"]: m for m in board["completeness"]["missing"]}
    assert (missing[budget["id"]]["project"]["code"], missing[budget["id"]]["product"]) == (
        "PRJ-042",
        None,
    )
    assert missing[nps["id"]]["product"] == {
        "id": product["id"],
        "name": "Customer portal",
        "active": True,
    }
