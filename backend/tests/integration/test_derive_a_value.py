"""One test per scenario of "Derive a value" in specs/derived-metrics/spec.md."""

import datetime
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from tests.integration.derivations_api import derive, derived, derived_metric, errors_of
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, record, tile
from tests.integration.teams_api import register

UNITS = ["BPW", "CKBiR", "CKI-P", "CKS", "CKT", "CKI-S"]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """The team Zarząd; today is Monday the 12th."""
    freeze_today(monkeypatch)
    return str(register(client, "Zarząd", "lead.zarzad@pse.pl")["id"])


def test_the_mean_of_six_units(client: TestClient, team: str) -> None:
    """Scenario: The mean of six units."""
    units = [add_metric(client, team, f"OTIF E: {unit}")["id"] for unit in UNITS]
    otif = derived_metric(client, team, "OTIF E", "mean", *((team, unit) for unit in units))
    meeting = open_meeting(client, team, "2026-10-14")
    for unit, number in zip(units, ["90", "97", "87", "83", "105", "101"], strict=True):
        record(client, team, meeting["id"], unit, value=number)

    result = derived(client, team, meeting["id"], otif["id"])

    assert (result["value"], result["kind"]) == ("93.833333", "mean")
    assert [
        (s["metric"]["name"], s["team"]["name"], s["meeting_id"], s["date"], s["value"])
        for s in result["sources"]
    ] == [
        (f"OTIF E: {unit}", "Zarząd", meeting["id"], "2026-10-14", number)
        for unit, number in zip(UNITS, ["90", "97", "87", "83", "105", "101"], strict=True)
    ]
    assert all(source["previous"] is None for source in result["sources"])
    assert tile(board_of(client, team, meeting["id"]), otif["id"])["value"] is None


def test_a_sum(client: TestClient, team: str) -> None:
    """Scenario: A sum."""
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    ours = add_metric(client, team, "Ours")
    theirs = add_metric(client, other, "Theirs")
    total = derived_metric(client, team, "Total", "sum", (team, ours["id"]), (other, theirs["id"]))
    meeting = open_meeting(client, team, "2026-10-14")
    their_meeting = open_meeting(client, other, "2026-10-13")
    record(client, team, meeting["id"], ours["id"], value="12.5")
    record(client, other, their_meeting["id"], theirs["id"], value="7")

    result = derived(client, team, meeting["id"], total["id"])

    assert (result["value"], result["kind"]) == ("19.5", "sum")
    assert [(s["date"], s["value"]) for s in result["sources"]] == [
        ("2026-10-14", "12.5"),
        ("2026-10-13", "7"),
    ]


def test_a_delta(client: TestClient, team: str) -> None:
    """Scenario: A delta."""
    headcount = add_metric(client, team, "Zatrudnienie")
    delta = derived_metric(client, team, "Zatrudnienie delta", "delta", (team, headcount["id"]))
    previous = open_meeting(client, team, "2026-10-07")
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, previous["id"], headcount["id"], value="395")
    record(client, team, meeting["id"], headcount["id"], value="391")

    result = derived(client, team, meeting["id"], delta["id"])

    assert (result["value"], result["kind"]) == ("-4", "delta")
    [source] = result["sources"]
    assert (source["meeting_id"], source["date"], source["value"]) == (
        meeting["id"],
        "2026-10-14",
        "391",
    )
    assert source["previous"] == {
        "meeting_id": previous["id"],
        "date": "2026-10-07",
        "value": "395",
    }


def test_a_source_has_no_number(client: TestClient, team: str) -> None:
    """Scenario: A source has no number."""
    other = register(client, "CKI-S", "lead.ckis@pse.pl")["id"]
    unrecorded = add_metric(client, team, "Unrecorded")
    last_week = add_metric(client, other, "Last week")
    recorded = add_metric(client, team, "Recorded")
    otif = derived_metric(
        client,
        team,
        "OTIF E",
        "mean",
        (team, unrecorded["id"]),
        (other, last_week["id"]),
        (team, recorded["id"]),
    )
    meeting = open_meeting(client, team, "2026-10-14")
    # The other team met the week before, and not this week.
    theirs = open_meeting(client, other, "2026-10-08")
    record(client, other, theirs["id"], last_week["id"], value="80")
    record(client, team, meeting["id"], recorded["id"], value="90")
    record(client, team, meeting["id"], unrecorded["id"], comment="Not in yet")
    from_them_only = derived_metric(client, team, "From them", "mean", (other, last_week["id"]))

    response = derive(client, team, meeting["id"], otif["id"])
    nothing_that_week = derive(client, team, meeting["id"], from_them_only["id"])

    assert response.status_code == nothing_that_week.status_code == 409
    assert errors_of(response) == [
        ("sources[0]", "derivation.source_missing"),
        ("sources[1]", "derivation.source_missing"),
    ]
    assert errors_of(nothing_that_week) == [("sources[0]", "derivation.source_missing")]
    assert tile(board_of(client, team, meeting["id"]), otif["id"])["value"] is None


def test_the_previous_number_is_missing(
    client: TestClient, team: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The previous number is missing."""
    headcount = add_metric(client, team, "Zatrudnienie")
    delta = derived_metric(client, team, "Zatrudnienie delta", "delta", (team, headcount["id"]))
    earlier = open_meeting(client, team, "2026-09-30")
    open_meeting(client, team, "2026-10-07")
    meeting = open_meeting(client, team, "2026-10-14")
    freeze_today(monkeypatch, datetime.date(2026, 9, 29))
    record(client, team, earlier["id"], headcount["id"], value="400")
    freeze_today(monkeypatch)
    record(client, team, meeting["id"], headcount["id"], value="391")
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    first = add_metric(client, other, "Zatrudnienie")
    their_delta = derived_metric(client, other, "Delta", "delta", (other, first["id"]))
    only = open_meeting(client, other, "2026-10-13")
    record(client, other, only["id"], first["id"], value="10")

    no_number_before = derive(client, team, meeting["id"], delta["id"])
    no_meeting_before = derive(client, other, only["id"], their_delta["id"])

    assert no_number_before.status_code == no_meeting_before.status_code == 409
    assert (
        errors_of(no_number_before)
        == errors_of(no_meeting_before)
        == [("sources[0]", "derivation.previous_missing")]
    )


def test_a_metric_with_no_derivation(client: TestClient, team: str) -> None:
    """Scenario: A metric with no derivation."""
    typed = add_metric(client, team, "Typed in")
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, meeting["id"], typed["id"], value="5")

    response = derive(client, team, meeting["id"], typed["id"])

    assert response.status_code == 404
    assert errors_of(response) == [(None, "derivation.none")]


def test_anyone_signed_in_may_derive(
    client: TestClient, client_as: Callable[[str], TestClient], team: str
) -> None:
    """Scenario: Anyone signed in may derive."""
    source = add_metric(client, team, "Source")
    copy = derived_metric(client, team, "Copy", "mean", (team, source["id"]))
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, meeting["id"], source["id"], value="7.25")

    result = derived(client_as("stranger@example.com"), team, meeting["id"], copy["id"])

    assert result["value"] == "7.25"


def test_a_derived_number_too_large_to_store_is_refused(client: TestClient, team: str) -> None:
    first = add_metric(client, team, "First")
    second = add_metric(client, team, "Second")
    total = derived_metric(client, team, "Total", "sum", (team, first["id"]), (team, second["id"]))
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, meeting["id"], first["id"], value="999999999999999")
    record(client, team, meeting["id"], second["id"], value="1")

    response = derive(client, team, meeting["id"], total["id"])

    assert response.status_code == 409
    assert errors_of(response) == [(None, "metric_value.out_of_range")]


def _statements(session: Session, call: Any) -> int:
    count = 0

    def counted(*_: Any) -> None:
        nonlocal count
        count += 1

    connection = session.connection()
    event.listen(connection, "before_cursor_execute", counted)
    try:
        call()
    finally:
        event.remove(connection, "before_cursor_execute", counted)
    return count


def test_deriving_takes_a_fixed_number_of_statements(
    client: TestClient, session: Session, team: str
) -> None:
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    meeting = open_meeting(client, team, "2026-10-14")
    their_meeting = open_meeting(client, other, "2026-10-13")
    first = add_metric(client, team, "Source 0")
    record(client, team, meeting["id"], first["id"], value="1")
    one = derived_metric(client, team, "One", "sum", (team, first["id"]))
    pairs = [(team, first["id"])]
    for index in range(1, 6):
        owner, at = (team, meeting) if index % 2 else (other, their_meeting)
        source = add_metric(client, owner, f"Source {index}")
        record(client, owner, at["id"], source["id"], value=str(index))
        pairs.append((owner, source["id"]))
    six = derived_metric(client, team, "Six", "sum", *pairs)

    cost_of_one = _statements(session, lambda: derived(client, team, meeting["id"], one["id"]))
    cost_of_six = _statements(session, lambda: derived(client, team, meeting["id"], six["id"]))

    assert derived(client, team, meeting["id"], six["id"])["value"] == "16"
    # The caller's employee lookup, then the metric, the meeting, the sources,
    # their teams' meetings and the values.
    assert cost_of_one == cost_of_six == 6
