"""Loading a legacy Boardmeeting backup, read back through the API."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from scripts.import_legacy_board import (
    HAND_COLOUR_COMMENT,
    LegacyImportError,
    Summary,
    load,
    read_definitions,
    remove_team,
)
from tests.integration.metrics_api import board_of, metrics_of, trend_of
from tests.legacy_board_fixture import TOOL_HTML, backup

ACTOR = "importer@example.com"


def _load(session: Session) -> Summary:
    return load(
        session,
        backup(),
        read_definitions(TOOL_HTML),
        team_name="Zarząd",
        board_name="Board Zarządu",
        actor_email=ACTOR,
    )


@pytest.fixture
def team(session: Session, client: TestClient) -> dict[str, object]:
    _load(session)
    [loaded] = [t for t in client.get("/teams").json() if t["name"] == "Zarząd"]
    return client.get(f"/teams/{loaded['id']}").json()


def test_the_team_its_board_and_its_people_are_loaded(
    client: TestClient, team: dict[str, object]
) -> None:
    assert team["board"]["name"] == "Board Zarządu"
    assert team["board"]["schedule"] == {"weekday": 3, "time": "13:00"}
    assert sorted((m["email"], m["is_leader"]) for m in team["members"]) == [
        ("ewa.nowak@pse.pl", False),
        ("jan.kowalski@pse.pl", False),
        ("zofia.lecka@pse.pl", True),
    ]


def test_a_meeting_per_week_hosted_by_that_weeks_leader(
    client: TestClient, team: dict[str, object]
) -> None:
    meetings = client.get(f"/teams/{team['id']}/meetings").json()["meetings"]

    assert [(m["date"], m["time"], (m["host"] or {}).get("email")) for m in meetings] == [
        ("2026-09-23", "13:00", None),
        ("2026-09-30", "13:00", "jan.kowalski@pse.pl"),
        ("2026-10-07", "13:00", "ewa.nowak@pse.pl"),
    ]


def test_metrics_in_their_units_with_one_per_unit_and_no_pulse(
    client: TestClient, team: dict[str, object]
) -> None:
    metrics = metrics_of(client, team["id"])

    assert [(m["name"], m["unit"], m["direction"], m["group_label"]) for m in metrics] == [
        ("Revenue", "mln zł", "higher_is_better", "Finance"),
        ("Backlog: overdue", "", "lower_is_better", "Delivery"),
        ("Effort ratio", "%", "within_band", "Productivity"),
        ("OTIF by unit", "%", "higher_is_better", "Delivery"),
        ("OTIF by unit: North", "%", "higher_is_better", "Delivery"),
        ("OTIF by unit: South", "%", "higher_is_better", "Delivery"),
    ]


def test_statuses_follow_the_legacy_rule_and_its_overrides(
    client: TestClient, team: dict[str, object]
) -> None:
    meetings = client.get(f"/teams/{team['id']}/meetings").json()["meetings"]
    board = board_of(client, team["id"], meetings[-1]["id"])
    tiles = {t["metric"]["name"]: t for t in board["metrics"]}

    # Backlog 3 is amber by the rule; the legacy board overrode it to red.
    backlog = tiles["Backlog: overdue"]
    assert (backlog["status"], backlog["set_by_hand"], backlog["comment"]) == (
        "red",
        True,
        HAND_COLOUR_COMMENT,
    )
    effort = tiles["Effort ratio"]
    assert (effort["value"], effort["status"], effort["comment"]) == (
        "71.8",
        "green",
        "Explained by the CFO",
    )
    # Not typed in: the legacy board showed the average of its units.
    assert (tiles["OTIF by unit"]["value"], tiles["OTIF by unit"]["status"]) == ("90", "amber")
    # Amber both ways, so the unit's colour is not a colour set by hand.
    north = tiles["OTIF by unit: North"]
    assert (north["status"], north["set_by_hand"]) == ("amber", False)
    assert tiles["Revenue"]["value"] is None


def test_a_threshold_version_each_time_the_target_changed(
    client: TestClient, team: dict[str, object]
) -> None:
    revenue = next(m for m in metrics_of(client, team["id"]) if m["name"] == "Revenue")
    points = trend_of(client, team["id"], revenue["id"])["points"]

    assert [(p["value"], p["threshold"]["green_lo"]) for p in points[:2]] == [
        ("171", "174"),
        ("168.997589", "174.122665"),
    ]
    assert [p["status"] for p in points[:2]] == ["amber", "red"]
    assert Decimal(points[1]["threshold"]["amber_lo"]) == Decimal("169.122665")


def test_loading_again_is_refused_and_replacing_works(session: Session) -> None:
    _load(session)
    with pytest.raises(LegacyImportError, match="--replace"):
        _load(session)

    assert remove_team(session, "zarząd")
    summary = _load(session)
    assert summary.employees_added == 0  # the people are kept, not duplicated


def test_what_cannot_be_loaded_yet_is_counted(session: Session) -> None:
    summary = _load(session)

    assert summary.skipped == {"pulse metric": 1, "problems": 1, "tasks": 2}


def test_a_file_that_is_not_a_backup_is_refused(session: Session) -> None:
    with pytest.raises(LegacyImportError, match="boardmeeting-backup"):
        load(
            session,
            {"format": "other"},
            read_definitions(TOOL_HTML),
            team_name="X",
            board_name="X",
            actor_email=ACTOR,
        )


def test_people_who_already_exist_are_reused(session: Session) -> None:
    from app.models import Employee

    session.add(Employee(email="jan.kowalski@pse.pl"))
    session.flush()

    assert _load(session).employees_added == 2
