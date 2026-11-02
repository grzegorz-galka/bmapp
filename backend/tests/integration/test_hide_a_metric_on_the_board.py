"""One test per scenario of "Hide a metric on the board" in specs/metrics/spec.md."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    metrics_of,
    record,
    tile,
)
from tests.integration.teams_api import add, register

LEADER = "lead@pse.pl"
MEMBER = "member@pse.pl"


def _hide(client: TestClient, team_id: str, metric_id: str, hidden: bool = True) -> Any:
    return client.patch(f"/teams/{team_id}/metrics/{metric_id}", json={"hidden": hidden})


def test_a_metric_is_hidden(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A metric is hidden."""
    freeze_today(monkeypatch)
    team = register(client)
    metric = add_metric(client, team["id"], "Zatrudnienie")
    meeting = open_meeting(client, team["id"], "2026-10-14")

    response = _hide(client, team["id"], metric["id"])

    assert response.status_code == 200, response.json()
    hidden = response.json()
    assert (hidden["hidden"], hidden["retired"]) == (True, False)
    assert record(client, team["id"], meeting["id"], metric["id"], value="376")["value"] == "376"
    on_board = tile(board_of(client, team["id"], meeting["id"]), metric["id"])
    assert (on_board["metric"]["hidden"], on_board["value"]) == (True, "376")


def test_a_hidden_metric_is_shown_again(client: TestClient) -> None:
    """Scenario: A hidden metric is shown again."""
    team = register(client)
    metric = add_metric(client, team["id"], "Zatrudnienie", hidden=True)

    response = _hide(client, team["id"], metric["id"], hidden=False)

    assert response.status_code == 200, response.json()
    assert response.json()["hidden"] is False
    assert [m["hidden"] for m in metrics_of(client, team["id"])] == [False]


def test_a_new_metric_is_shown_by_default(client: TestClient, session: Session) -> None:
    """Scenario: A new metric is shown by default."""
    team = register(client)
    source = add_metric(client, register(client, "Billing", "lead.billing@example.com")["id"])
    availability = seed_global_metric(session)

    added = [
        add_metric(client, team["id"], "Zatrudnienie"),
        client.post(
            f"/teams/{team['id']}/metrics/copies", json={"source_metric_id": source["id"]}
        ).json(),
        include(client, team["id"], availability),
    ]

    assert [metric["hidden"] for metric in added] == [False, False, False]


def test_a_metric_is_created_hidden(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario: A metric is created hidden."""
    freeze_today(monkeypatch)
    team = register(client)
    meeting = open_meeting(client, team["id"], "2026-10-14")

    metric = add_metric(client, team["id"], "Zatrudnienie", hidden=True)

    assert (metric["hidden"], metric["retired"]) == (True, False)
    # The board returns it marked hidden, which is what leaves its tile out.
    assert tile(board_of(client, team["id"], meeting["id"]), metric["id"])["metric"]["hidden"]


def test_a_metric_is_copied_or_included_hidden(client: TestClient, session: Session) -> None:
    """Scenario: A metric is copied or included hidden."""
    team = register(client)
    other = register(client, "Billing", "lead.billing@example.com")
    source = add_metric(client, other["id"], "Zatrudnienie")
    availability = seed_global_metric(session)
    theirs = include(client, other["id"], availability)

    copied = client.post(
        f"/teams/{team['id']}/metrics/copies",
        json={"source_metric_id": source["id"], "hidden": True},
    )
    included = include(client, team["id"], availability, hidden=True)

    assert copied.status_code == 201, copied.json()
    assert (copied.json()["hidden"], included["hidden"]) == (True, True)
    assert {m["id"]: m["hidden"] for m in metrics_of(client, team["id"])} == {
        copied.json()["id"]: True,
        availability: True,
    }
    assert {m["id"]: m["hidden"] for m in metrics_of(client, other["id"])} == {
        source["id"]: False,
        availability: False,
    }
    assert theirs["hidden"] is False


def test_only_whoever_configures_the_board_hides_a_metric(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session
) -> None:
    """Scenario: Only whoever configures the board hides a metric."""
    team = register(client, "Platform", LEADER)
    add(client, team["id"], MEMBER)
    metric = add_metric(client, team["id"], "Zatrudnienie")
    availability = seed_global_metric(session)
    included = include(client, team["id"], availability)
    member = client_as(MEMBER)

    responses = [
        _hide(member, team["id"], metric["id"]),
        _hide(member, team["id"], availability),
        member.post(
            f"/teams/{team['id']}/metrics",
            json={"name": "Costs", "direction": "lower_is_better", "hidden": True},
        ),
    ]

    assert [(r.status_code, error_of(r)) for r in responses] == [
        (403, (None, "auth.forbidden"))
    ] * 3
    assert metrics_of(client, team["id"]) == [metric, included]
