"""One test per scenario of "A global metric's values belong to each team".

In specs/metric-values/spec.md.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import ADMIN_EMAIL
from tests.integration.global_metrics_seed import (
    include,
    seed_global_metric,
    seed_global_threshold,
)
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    record,
    tile,
    trend_of,
)
from tests.integration.teams_api import add, member_id, register

OWNER = "owner@example.com"


def test_two_teams_record_the_same_global_metric(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: Two teams record the same global metric."""
    freeze_today(monkeypatch)
    team = register(client, "Platform", "lead.platform@example.com")
    other = register(client, "Billing", "lead.billing@example.com")
    availability = seed_global_metric(session)
    seed_global_threshold(session, availability, green_lo="99.5", amber_lo="99")
    include(client, team["id"], availability)
    include(client, other["id"], availability)
    earlier = open_meeting(client, team["id"], "2026-10-07")
    ours = open_meeting(client, team["id"], "2026-10-14")
    theirs = open_meeting(client, other["id"], "2026-10-14")
    record(client, team["id"], ours["id"], availability, value="99.1")
    record(client, other["id"], theirs["id"], availability, value="99.8")
    # 30.9 is frozen: an administrator's correction there stays in our trend only.
    frozen = open_meeting(client, team["id"], "2026-09-30")["id"]
    record(client, team["id"], frozen, availability, value="98", reason="Late data")

    our_tile = tile(board_of(client, team["id"], ours["id"]), availability)
    their_tile = tile(board_of(client, other["id"], theirs["id"]), availability)
    assert (our_tile["value"], our_tile["status"]) == ("99.1", "amber")
    assert (their_tile["value"], their_tile["status"]) == ("99.8", "green")
    assert [p["value"] for p in our_tile["sparkline"]] == ["98", None, "99.1"]
    assert [p["value"] for p in their_tile["sparkline"]] == ["99.8"]

    our_trend = trend_of(client, team["id"], availability)
    their_trend = trend_of(client, other["id"], availability)
    assert [(p["meeting_id"], p["value"]) for p in our_trend["points"]] == [
        (frozen, "98"),
        (earlier["id"], None),
        (ours["id"], "99.1"),
    ]
    assert [(p["meeting_id"], p["value"]) for p in their_trend["points"]] == [
        (theirs["id"], "99.8")
    ]
    assert [c["corrected_by_email"] for c in our_trend["corrections"]] == [ADMIN_EMAIL]
    assert their_trend["corrections"] == []


def test_a_global_metric_counts_towards_a_boards_completeness(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A global metric counts towards a board's completeness."""
    freeze_today(monkeypatch)
    team = register(client)
    other = register(client, "Billing", "lead.billing@example.com")
    owner = member_id(add(client, team["id"], OWNER), OWNER)
    own = [add_metric(client, team["id"], name) for name in "ABC"]
    availability = seed_global_metric(session)
    include(client, team["id"], availability, owner_employee_id=owner)
    include(client, other["id"], availability)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    for metric in own:
        record(client, team["id"], meeting["id"], metric["id"], value="1")

    completeness = board_of(client, team["id"], meeting["id"])["completeness"]

    assert (completeness["recorded"], completeness["total"]) == (3, 4)
    [missing] = completeness["missing"]
    assert (missing["metric_id"], missing["name"], missing["owner"]["email"]) == (
        availability,
        "Service availability",
        OWNER,
    )
