"""The API scenarios of "The summary is language-neutral" in specs/dashboard/spec.md.

*An assigned item's summary is returned as typed* is in
test_the_items_assigned_to_the_viewer.py, beside the other assigned items.
"""

import datetime
import re
from collections.abc import Callable
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.core.item_enums import Stage
from tests.integration.dashboard_api import (
    VIEWER,
    dashboard_of,
    freeze_today,
    problem_for,
    task_for,
    team_with,
)
from tests.integration.meetings_api import open_meeting, set_schedule
from tests.integration.teams_api import register

ClientAs = Callable[[str], TestClient]


@pytest.fixture
def viewer(client: TestClient, client_as: ClientAs, monkeypatch: pytest.MonkeyPatch) -> Any:
    """The dashboard of a viewer leading one team and member of another, with items and meetings."""
    freeze_today(monkeypatch)
    led = register(client, "Platform", VIEWER)
    set_schedule(client, led["id"], weekday=3, time="13:00")
    team = team_with(client, "Payments", VIEWER)
    open_meeting(client, team["id"], "2026-10-12", "09:30")
    problem_for(client, team, VIEWER, "Builds are flaky", due_on="2026-10-14", stage="plan")
    task_for(client, team, VIEWER, "Update the agenda")
    return dashboard_of(client_as(VIEWER))


def test_prose_carries_both_languages(client: TestClient) -> None:
    """Scenario: Prose carries both languages."""
    declarations = dashboard_of(client)["declarations"]

    strategy = declarations["strategy"]
    texts = [
        declarations["mission"],
        declarations["vision"],
        *(value["name"] for value in declarations["values"]),
        strategy["horizon"],
        *strategy["statements"],
        *(group["horizon"] for group in declarations["goals"]),
        *(item for group in declarations["goals"] for item in group["items"]),
    ]
    assert len(texts) == 2 + 4 + 1 + 2 + 2 + 4
    for text in texts:
        assert set(text) == {"en", "pl"}, text
        assert text["en"].strip(), text
        assert text["pl"].strip(), text
        # A catalogue wired to itself would otherwise pass the checks above.
        assert text["en"] != text["pl"], text


def test_states_are_returned_as_codes(viewer: Any) -> None:
    """Scenario: States are returned as codes."""
    assert {(team["name"], team["role"]) for team in viewer["teams"]} == {
        ("Platform", "leader"),
        ("Payments", "member"),
    }
    assert {value["icon"] for value in viewer["declarations"]["values"]} == {
        "effectiveness",
        "passion",
        "innovation",
        "collaboration",
    }
    assert [stage["stage"] for stage in viewer["funnel"]["stages"]] == [
        "open",
        "in_progress",
        "archived",
    ]
    assert {(item["kind"], item["stage"]) for item in viewer["assigned_items"]} == {
        ("problem", "plan"),
        ("task", "not_started"),
    }
    for item in viewer["assigned_items"]:
        assert item["stage"] in set(Stage)
        # No text meant for display beside the codes: the item carries its
        # identifiers, its typed summary, its team's name, its due date and
        # its links.
        assert set(item) == {
            "id",
            "kind",
            "summary",
            "team_id",
            "team",
            "stage",
            "due_on",
            "overdue",
            "metric",
            "problem",
        }


def _utc(text: str) -> datetime.datetime:
    instant = datetime.datetime.fromisoformat(text)
    assert instant.utcoffset() == datetime.timedelta(0), text
    return instant


def test_times_are_returned_as_iso_8601(viewer: Any) -> None:
    """Scenario: Times are returned as ISO 8601."""
    warsaw = ZoneInfo("Europe/Warsaw")
    assert [(m["team"], m["date"], m["start_time"]) for m in viewer["meetings"]] == [
        ("Payments", "2026-10-12", "09:30"),
        ("Platform", "2026-10-14", "13:00"),
    ]
    for meeting in viewer["meetings"]:
        local = _utc(meeting["starts_at"]).astimezone(warsaw)
        assert local.date() == datetime.date.fromisoformat(meeting["date"])
        assert re.fullmatch(r"\d\d:\d\d", meeting["start_time"])
        assert local.strftime("%H:%M") == meeting["start_time"]
    assert sorted(_utc(team["next_meeting_at"]) for team in viewer["teams"]) == [
        datetime.datetime(2026, 10, 12, 7, 30, tzinfo=datetime.UTC),
        datetime.datetime(2026, 10, 14, 11, 0, tzinfo=datetime.UTC),
    ]
    assert [item["due_on"] for item in viewer["assigned_items"]] == ["2026-10-14", None]
