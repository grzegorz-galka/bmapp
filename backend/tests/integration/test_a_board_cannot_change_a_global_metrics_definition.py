"""One test per scenario of "A board cannot change a global metric's definition".

In specs/global-metrics/spec.md.
"""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Metric, MetricThreshold
from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import metrics_of
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"
THRESHOLD = {"effective_from": "2026-10-01", "reason": "Plan", "green": "99.5", "amber": "99"}


def test_a_leader_moves_and_regroups_a_global_metric(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: A leader moves and regroups a global metric."""
    team = register(client, "Platform", LEADER)
    other = register(client, "Billing", "lead.billing@example.com")
    owner = member_id(add(client, team["id"], MEMBER), MEMBER)
    availability = seed_global_metric(session)
    include(client, team["id"], availability, position=1, group_label="Ops")
    theirs = include(client, other["id"], availability, position=7, group_label="Service")

    response = client_as(LEADER).patch(
        f"/teams/{team['id']}/metrics/{availability}",
        json={
            "position": 3,
            "group_label": "Operations",
            "owner_employee_id": owner,
            # Repeating the definition is no change, so it is accepted.
            "name": "Service availability",
            "direction": "higher_is_better",
        },
    )

    assert response.status_code == 200, response.json()
    changed = response.json()
    assert (changed["position"], changed["group_label"], changed["owner"]["email"]) == (
        3,
        "Operations",
        MEMBER,
    )
    assert (changed["scope"], changed["name"]) == ("global", "Service availability")
    assert metrics_of(client, other["id"]) == [theirs]


@pytest.mark.parametrize(
    ("field", "value"),
    [("name", "Uptime"), ("unit", "pct"), ("decimals", 3), ("direction", "lower_is_better")],
)
def test_a_leader_renames_a_global_metric_on_their_board(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    session: Session,
    field: str,
    value: object,
) -> None:
    """Scenario: A leader renames a global metric on their board."""
    team = register(client, "Platform", LEADER)
    availability = seed_global_metric(session)
    before = include(client, team["id"], availability, position=1)

    response = client_as(LEADER).patch(
        f"/teams/{team['id']}/metrics/{availability}", json={field: value, "position": 4}
    )

    assert response.status_code == 409
    assert error_of(response) == (field, "global_metric.read_only")
    assert metrics_of(client, team["id"]) == [before]
    metric = session.get(Metric, uuid.UUID(availability))
    assert metric is not None
    session.refresh(metric)
    assert (metric.name, metric.unit, metric.decimals) == ("Service availability", "%", 2)


@pytest.mark.parametrize("actor", [LEADER, "admin@pse.pl"])
def test_a_threshold_cannot_be_recorded_through_a_board(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session, actor: str
) -> None:
    """Scenario: A threshold cannot be recorded through a board."""
    team = register(client, "Platform", LEADER)
    availability = seed_global_metric(session)
    include(client, team["id"], availability)

    response = client_as(actor).post(
        f"/teams/{team['id']}/metrics/{availability}/thresholds", json=THRESHOLD
    )

    assert response.status_code == 409
    assert error_of(response) == (None, "global_metric.read_only")
    versions = session.scalar(
        select(func.count())
        .select_from(MetricThreshold)
        .where(MetricThreshold.metric_id == uuid.UUID(availability))
    )
    assert versions == 0
