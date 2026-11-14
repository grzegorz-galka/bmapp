"""One test per scenario of "Copy a metric from another board" in specs/metrics/spec.md."""

import datetime
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_group,
    add_metric,
    add_threshold,
    board_of,
    freeze_today,
    groups_of,
    metrics_of,
    placement,
    record,
    seed_version_before_target_values,
    thresholds_of,
    tile,
    trend_of,
)
from tests.integration.project_metrics_api import add_metric_of
from tests.integration.projects_api import add_product, add_project
from tests.integration.teams_api import add, member_id, register

LEADER = "lead@pse.pl"
SOURCE_LEADER = "lead.billing@example.com"
SOURCE_OWNER = "owner.billing@example.com"


def _copy(client: TestClient, team_id: str, source_metric_id: str, **fields: Any) -> Any:
    return client.post(
        f"/teams/{team_id}/metrics/copies", json={"source_metric_id": source_metric_id, **fields}
    )


def _boards(client: TestClient) -> tuple[str, str]:
    """The leader's board, and another team's board they are no member of."""
    team = register(client, "Platform", LEADER)
    source = register(client, "Billing", SOURCE_LEADER)
    return team["id"], source["id"]


def test_a_metric_is_copied_with_its_thresholds(
    client: TestClient, client_as: Callable[[str], TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A metric is copied with its thresholds."""
    freeze_today(monkeypatch)
    team_id, source_id = _boards(client)
    owner = member_id(add(client, source_id, SOURCE_OWNER), SOURCE_OWNER)
    quality = add_group(client, source_id, "Quality")
    engineering = add_group(client, team_id, "Engineering")
    existing = add_metric(client, team_id, "Deployments", group_id=engineering["id"])
    bugs = add_metric(
        client,
        source_id,
        "Open bugs",
        unit="",
        direction="lower_is_better",
        group_id=quality["id"],
        owner_employee_id=owner,
    )
    add_threshold(client, source_id, bugs["id"], "2026-07-01", "Baseline", green="10", amber="20")
    add_threshold(client, source_id, bugs["id"], "2026-09-01", "Tighter", green="5", amber="12")
    theirs = open_meeting(client, source_id, "2026-10-14")
    record(client, source_id, theirs["id"], bugs["id"], value="7")
    before = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=5)

    response = _copy(client_as(LEADER), team_id, bugs["id"], group_id=engineering["id"])

    assert response.status_code == 201, response.json()
    copy = response.json()
    assert copy["id"] != bugs["id"]
    assert {k: copy[k] for k in ("team_id", "scope", "name", "unit", "direction", "owner")} == {
        "team_id": team_id,
        "scope": "board",
        "name": "Open bugs",
        "unit": "",
        "direction": "lower_is_better",
        "owner": None,
    }
    assert (copy["retired"], placement(copy)) == (False, ("Engineering", 1))
    assert [m["id"] for m in metrics_of(client, team_id)] == [existing["id"], copy["id"]]
    ours = open_meeting(client, team_id, "2026-10-14")
    assert tile(board_of(client, team_id, ours["id"]), copy["id"])["value"] is None
    assert [p["value"] for p in trend_of(client, team_id, copy["id"])["points"]] == [None]

    def summary(version: Any) -> tuple[str, str, str, str]:
        return (
            version["effective_from"],
            version["green_hi"],
            version["amber_hi"],
            version["reason"],
        )

    copied = thresholds_of(client, team_id, copy["id"])
    assert [summary(v) for v in copied] == [
        summary(v) for v in thresholds_of(client, source_id, bugs["id"])
    ]
    assert [v["recorded_by_email"] for v in copied] == [LEADER, LEADER]
    assert all(datetime.datetime.fromisoformat(v["recorded_at"]) >= before for v in copied)


def test_target_values_and_tolerances_are_copied(client: TestClient, session: Session) -> None:
    """Scenario: Target values and tolerances are copied."""
    team_id, source_id = _boards(client)
    source = add_metric(client, source_id, "Utylizacja", direction="within_band")
    seed_version_before_target_values(
        session,
        source["id"],
        "2026-04-01",
        green_lo="71",
        green_hi="72",
        amber_lo="70",
        amber_hi="73",
    )
    add_threshold(
        client,
        source_id,
        source["id"],
        "2026-11-01",
        target_value="72.3",
        green_pct="5",
        amber_pct="10",
    )

    response = _copy(client, team_id, source["id"])

    assert response.status_code == 201, response.json()
    fields = ("effective_from", "target_value", "green_pct", "amber_pct", "green_lo", "amber_hi")
    shapes = [
        [{k: v[k] for k in fields} for v in thresholds_of(client, board, metric)]
        for board, metric in ((source_id, source["id"]), (team_id, response.json()["id"]))
    ]
    assert (
        shapes[1]
        == shapes[0]
        == [
            {
                "effective_from": "2026-11-01",
                "target_value": "72.3",
                "green_pct": "5",
                "amber_pct": "10",
                "green_lo": "68.685",
                "amber_hi": "79.53",
            },
            {
                "effective_from": "2026-04-01",
                "target_value": None,
                "green_pct": None,
                "amber_pct": None,
                "green_lo": "71",
                "amber_hi": "73",
            },
        ]
    )


def test_a_hidden_metric_is_copied_as_shown(client: TestClient) -> None:
    """Scenario: A hidden metric is copied as shown."""
    team_id, source_id = _boards(client)
    source = add_metric(client, source_id, "Zatrudnienie", hidden=True)

    response = _copy(client, team_id, source["id"])

    assert response.status_code == 201, response.json()
    assert (source["hidden"], response.json()["hidden"]) == (True, False)
    assert [m["hidden"] for m in metrics_of(client, team_id)] == [False]


def test_a_copy_with_no_group_is_ungrouped(client: TestClient) -> None:
    """Scenario: A copy with no group is ungrouped."""
    team_id, source_id = _boards(client)
    quality = add_group(client, source_id, "Quality")
    source = add_metric(client, source_id, "Open bugs", group_id=quality["id"])
    add_metric(client, team_id, "Morale")

    response = _copy(client, team_id, source["id"])

    assert response.status_code == 201, response.json()
    assert placement(response.json()) == (None, 1)
    assert groups_of(client, team_id) == []


def test_a_copy_into_another_boards_group_is_refused(client: TestClient) -> None:
    team_id, source_id = _boards(client)
    quality = add_group(client, source_id, "Quality")
    source = add_metric(client, source_id, "Open bugs", group_id=quality["id"])

    response = _copy(client, team_id, source["id"], group_id=quality["id"])

    assert response.status_code == 404
    assert error_of(response) == ("group_id", "metric_group.not_found")
    assert metrics_of(client, team_id) == []


def test_the_same_version_is_in_force_on_every_date(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The same version is in force on every date."""
    freeze_today(monkeypatch)
    team_id, source_id = _boards(client)
    source = add_metric(client, source_id, "Open bugs", direction="lower_is_better")
    add_threshold(client, source_id, source["id"], "2026-01-01", "Start", green="20", amber="30")
    add_threshold(client, source_id, source["id"], "2026-10-01", "First", green="10", amber="15")
    add_threshold(client, source_id, source["id"], "2026-10-01", "Second", green="5", amber="8")
    add_threshold(client, source_id, source["id"], "2026-10-01", "Third", green="6", amber="9")

    copy = _copy(client, team_id, source["id"]).json()

    def in_force(team: str, metric_id: str, meeting_date: str) -> Any:
        meeting = open_meeting(client, team, meeting_date)
        record(client, team, meeting["id"], metric_id, value="7")
        entry = tile(board_of(client, team, meeting["id"]), metric_id)
        return entry["threshold"]["reason"], entry["status"]

    assert in_force(team_id, copy["id"], "2026-10-14") == ("Third", "amber")
    assert in_force(source_id, source["id"], "2026-10-14") == ("Third", "amber")
    assert copy["threshold"]["reason"] == "Third"
    # The history lists them in the same order as the source's.
    assert [v["reason"] for v in thresholds_of(client, team_id, copy["id"])] == [
        v["reason"] for v in thresholds_of(client, source_id, source["id"])
    ]


def test_a_copy_under_a_new_name(client: TestClient) -> None:
    """Scenario: A copy under a new name."""
    team_id, source_id = _boards(client)
    add_metric(client, team_id, "Revenue")
    source = add_metric(client, source_id, "Revenue")

    response = _copy(client, team_id, source["id"], name="  Revenue (Poland) ")

    assert response.status_code == 201, response.json()
    assert (response.json()["name"], placement(response.json())) == ("Revenue (Poland)", (None, 1))
    assert [m["name"] for m in metrics_of(client, team_id)] == ["Revenue", "Revenue (Poland)"]


@pytest.mark.parametrize("own", [True, False], ids=["own", "included global"])
def test_the_copied_name_is_taken(client: TestClient, session: Session, own: bool) -> None:
    """Scenario: The copied name is taken."""
    team_id, source_id = _boards(client)
    if own:
        add_metric(client, team_id, "availability")
    else:
        include(client, team_id, seed_global_metric(session, "availability"))
    source = add_metric(client, source_id, "Availability")
    before = metrics_of(client, team_id)

    response = _copy(client, team_id, source["id"])

    assert response.status_code == 409
    assert error_of(response) == ("name", "metric_name.duplicate")
    assert metrics_of(client, team_id) == before


def test_the_copy_is_independent_of_its_source(client: TestClient) -> None:
    """Scenario: The copy is independent of its source."""
    team_id, source_id = _boards(client)
    source = add_metric(client, source_id, "Open bugs", unit="pcs")
    add_threshold(client, source_id, source["id"], "2026-01-01", "Start", green="20", amber="10")
    copy = _copy(client, team_id, source["id"]).json()

    client.patch(f"/teams/{team_id}/metrics/{copy['id']}", json={"name": "Bugs"})
    add_threshold(client, team_id, copy["id"], "2026-06-01", "Ours", green="30", amber="20")
    client.patch(f"/teams/{source_id}/metrics/{source['id']}", json={"unit": "items"})
    add_threshold(client, source_id, source["id"], "2026-07-01", "Theirs", green="40", amber="30")

    [ours] = metrics_of(client, team_id)
    [theirs] = metrics_of(client, source_id)
    assert (ours["name"], ours["unit"]) == ("Bugs", "pcs")
    assert (theirs["name"], theirs["unit"]) == ("Open bugs", "items")
    assert [v["reason"] for v in thresholds_of(client, team_id, copy["id"])] == ["Ours", "Start"]
    assert [v["reason"] for v in thresholds_of(client, source_id, source["id"])] == [
        "Theirs",
        "Start",
    ]


def test_a_global_metric_is_not_copied(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: A global metric is not copied."""
    team_id, source_id = _boards(client)
    availability = seed_global_metric(session)
    include(client, source_id, availability)

    response = _copy(client_as(LEADER), team_id, availability)

    assert response.status_code == 409
    assert error_of(response) == ("source_metric_id", "metric_copy.source_global")
    assert metrics_of(client, team_id) == []


def test_a_projects_or_products_metric_is_not_copied(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: A project's or product's metric is not copied."""
    team_id, source_id = _boards(client)
    project = add_project(client, source_id)
    product = add_product(client, source_id)
    budget = add_metric_of(client, source_id, "Budget consumed", project_id=project["id"])
    nps = add_metric_of(client, source_id, "NPS", product_id=product["id"])
    # Of the leader's own team too: the rule is about the metric, not whose it is.
    own_project = add_project(client, team_id, code="PRJ-050")
    own_budget = add_metric_of(client, team_id, "Budget consumed", project_id=own_project["id"])

    from_project = _copy(client_as(LEADER), team_id, budget["id"])
    from_product = _copy(client_as(LEADER), team_id, nps["id"])
    from_own = _copy(client_as(LEADER), team_id, own_budget["id"], name="Budget (copy)")

    assert from_project.status_code == from_product.status_code == from_own.status_code == 409
    assert error_of(from_project) == ("source_metric_id", "metric_copy.source_project")
    assert error_of(from_product) == ("source_metric_id", "metric_copy.source_product")
    assert error_of(from_own) == ("source_metric_id", "metric_copy.source_project")
    assert [m["id"] for m in metrics_of(client, team_id)] == [own_budget["id"]]


def test_the_source_does_not_exist(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Scenario: The source does not exist."""
    team_id, _ = _boards(client)

    response = _copy(client_as(LEADER), team_id, str(uuid.uuid4()))

    assert response.status_code == 404
    assert error_of(response) == (None, "metric.not_found")
    assert metrics_of(client, team_id) == []


def test_a_copy_onto_a_team_that_does_not_exist(client: TestClient) -> None:
    _, source_id = _boards(client)
    source = add_metric(client, source_id)

    response = _copy(client, str(uuid.uuid4()), source["id"])

    assert response.status_code == 404
    assert error_of(response) == (None, "team.not_found")
