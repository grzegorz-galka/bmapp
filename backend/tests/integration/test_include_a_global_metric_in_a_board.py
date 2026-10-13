"""One test per scenario of "Include a global metric in a board" in specs/global-metrics/spec.md.

Plus "A retired global metric cannot be included" from "Retire or delete a
global metric", since it is a refusal of this endpoint.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import (
    include,
    retire_in_catalogue,
    seed_global_metric,
    seed_global_threshold,
)
from tests.integration.meetings_api import error_of
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    freeze_today,
    metrics_of,
    placement,
)
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"


def _include(client: TestClient, team_id: str, global_metric_id: str, **fields: object) -> Any:
    return client.post(
        f"/teams/{team_id}/metrics/inclusions",
        json={"global_metric_id": global_metric_id, **fields},
    )


def test_a_global_metric_is_included(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario: A global metric is included."""
    freeze_today(monkeypatch)
    team = register(client, "Platform", LEADER)
    owner = member_id(add(client, team["id"], MEMBER), MEMBER)
    availability = seed_global_metric(session, "Service availability", unit="%", decimals=2)
    seed_global_threshold(session, availability, green_lo="99.5", amber_lo="99")
    operations = add_group(client, team["id"], "Operations")
    add_metric(client, team["id"], "Incidents", group_id=operations["id"])

    included = include(
        client_as(LEADER),
        team["id"],
        availability,
        group_id=operations["id"],
        owner_employee_id=owner,
    )

    _, listed = metrics_of(client, team["id"])
    assert listed == included
    assert {
        k: listed[k]
        for k in ("id", "team_id", "scope", "name", "unit", "decimals", "direction", "retired")
    } == {
        "id": availability,
        "team_id": team["id"],
        "scope": "global",
        "name": "Service availability",
        "unit": "%",
        "decimals": 2,
        "direction": "higher_is_better",
        "retired": False,
    }
    # Second in "Operations", after the metric already there.
    assert (placement(listed), listed["owner"]["email"]) == (("Operations", 1), MEMBER)
    assert (listed["threshold"]["green_lo"], listed["threshold"]["amber_lo"]) == ("99.5", "99")


def test_included_twice(client: TestClient, session: Session) -> None:
    """Scenario: Included twice."""
    team = register(client)
    operations = add_group(client, team["id"], "Operations")
    availability = seed_global_metric(session)
    include(client, team["id"], availability, group_id=operations["id"])

    response = _include(client, team["id"], availability)

    assert response.status_code == 409
    assert error_of(response) == ("global_metric_id", "global_metric.already_included")
    assert [placement(m) for m in metrics_of(client, team["id"])] == [("Operations", 0)]


def test_included_into_another_boards_group(client: TestClient, session: Session) -> None:
    """Scenario: Included into another board's group."""
    team = register(client)
    other = register(client, "Other", "lead.other@example.com")
    theirs = add_group(client, other["id"], "Operations")
    availability = seed_global_metric(session)

    response = _include(client, team["id"], availability, group_id=theirs["id"])

    assert response.status_code == 404
    assert error_of(response) == ("group_id", "metric_group.not_found")
    assert metrics_of(client, team["id"]) == []


def test_its_name_is_taken_on_the_board(client: TestClient, session: Session) -> None:
    """Scenario: Its name is taken on the board."""
    team = register(client)
    own = add_metric(client, team["id"], "availability")
    availability = seed_global_metric(session, "Availability")

    response = _include(client, team["id"], availability)

    assert response.status_code == 409
    assert error_of(response) == ("global_metric_id", "metric_name.duplicate")
    assert [m["id"] for m in metrics_of(client, team["id"])] == [own["id"]]


def test_the_owner_is_outside_the_team(client: TestClient, session: Session) -> None:
    """Scenario: The owner is outside the team."""
    team = register(client)
    other = register(client, "Other", "lead.other@example.com")
    outsider = member_id(add(client, other["id"], MEMBER), MEMBER)
    availability = seed_global_metric(session)

    response = _include(client, team["id"], availability, owner_employee_id=outsider)

    assert response.status_code == 409
    assert error_of(response) == ("owner_employee_id", "metric_owner.not_member")
    assert metrics_of(client, team["id"]) == []


def test_the_global_metric_does_not_exist(client: TestClient) -> None:
    """Scenario: The global metric does not exist."""
    team = register(client)
    other = register(client, "Other", "lead.other@example.com")
    # A board's own metric is not in the catalogue either.
    theirs = add_metric(client, other["id"])

    for unknown in (str(uuid.uuid4()), theirs["id"]):
        response = _include(client, team["id"], unknown)

        assert response.status_code == 404
        assert error_of(response) == (None, "metric.not_found")
    assert metrics_of(client, team["id"]) == []


def test_a_retired_global_metric_cannot_be_included(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: A retired global metric cannot be included."""
    team = register(client, "Platform", LEADER)
    availability = seed_global_metric(session)
    retire_in_catalogue(session, availability)

    response = _include(client_as(LEADER), team["id"], availability)

    assert response.status_code == 409
    assert error_of(response) == (None, "metric.retired")
    assert metrics_of(client, team["id"]) == []


def test_including_in_a_team_that_does_not_exist(client: TestClient, session: Session) -> None:
    availability = seed_global_metric(session)

    response = _include(client, str(uuid.uuid4()), availability)

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
