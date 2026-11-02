"""The threshold conversion against the database, its result read back through the API."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MetricThreshold
from scripts.convert_thresholds import RULE_MAPPING, ConversionError, convert, parse_mapping
from tests.integration.global_metrics_api import include
from tests.integration.global_metrics_seed import seed_global_metric, seed_global_threshold
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    record,
    seed_version_before_target_values,
)
from tests.integration.teams_api import register

ACTOR = "converter@pse.pl"
HEADER = (
    "team,metric,effective_from,target_value,green_pct,amber_pct,"
    "green_lo,green_hi,amber_lo,amber_hi,accept_changes\n"
)
COLUMNS = (
    "effective_from",
    "target_value",
    "green_pct",
    "amber_pct",
    "green_lo",
    "green_hi",
    "amber_lo",
    "amber_hi",
    "reason",
    "recorded_by_email",
    "recorded_at",
)


@pytest.fixture
def board(client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch) -> Any:
    """A board with one metric for each way a version converts, and values at a meeting.

    OTIF converts by its mapping row, Revenue by the default, Backlog keeps
    its range under the target value 0, and the global Availability by the
    default; Effort is a band, which only a mapping row converts.
    """
    freeze_today(monkeypatch)
    team = register(client, "Zarząd")
    metrics = {
        "OTIF": add_metric(client, team["id"], "OTIF"),
        "Revenue": add_metric(client, team["id"], "Revenue"),
        "Backlog": add_metric(client, team["id"], "Backlog", direction="lower_is_better"),
        "Effort": add_metric(client, team["id"], "Effort", direction="within_band"),
    }
    seed = seed_version_before_target_values
    seed(session, metrics["OTIF"]["id"], "2026-07-01", green_lo="95", amber_lo="90")
    seed(session, metrics["Revenue"]["id"], "2026-07-01", green_lo="174", amber_lo="174")
    seed(session, metrics["Revenue"]["id"], "2026-10-01", green_lo="180", amber_lo="171")
    seed(session, metrics["Backlog"]["id"], "2026-07-01", green_hi="0", amber_hi="5")
    seed(
        session,
        metrics["Effort"]["id"],
        "2026-07-01",
        green_lo="71",
        green_hi="72",
        amber_lo="70",
        amber_hi="73",
    )
    availability = seed_global_metric(session, "Availability")
    seed_global_threshold(session, availability, "2026-07-01", green_lo="100", amber_lo="98")
    session.commit()
    include(session, team["id"], availability, position=4)

    meeting = open_meeting(client, team["id"], "2026-10-14")
    for name, value in (
        ("OTIF", "92"),
        ("Revenue", "172"),
        ("Backlog", "3"),
        ("Effort", "71.5"),
    ):
        record(client, team["id"], meeting["id"], metrics[name]["id"], value=value)
    record(client, team["id"], meeting["id"], availability, value="98.5")
    return {"team": team, "meeting": meeting}


def _versions(session: Session) -> list[tuple[object, ...]]:
    rows = session.scalars(select(MetricThreshold).order_by(MetricThreshold.recorded_at))
    return [tuple(getattr(row, column) for column in COLUMNS) for row in rows]


def _statuses(client: TestClient, board: Any) -> dict[str, str]:
    tiles = board_of(client, board["team"]["id"], board["meeting"]["id"])["metrics"]
    return {tile["metric"]["name"]: tile["status"] for tile in tiles}


def _mapping(*lines: str) -> Any:
    return parse_mapping(HEADER + "".join(f"{line}\n" for line in lines))


def test_a_dry_run_writes_nothing(client: TestClient, session: Session, board: Any) -> None:
    before = _versions(session)

    result, written = convert(
        session, _mapping("Zarząd,OTIF,,100,5,10,,,,,no"), actor_email=ACTOR, apply=False
    )

    assert written is False
    assert len(result.proposals) == 5
    assert [n.metric.name for n in result.needs_mapping] == ["Effort"]
    assert _versions(session) == before


def test_apply_adds_twins_without_changing_a_version_or_a_status(
    client: TestClient, session: Session, board: Any
) -> None:
    before_versions = _versions(session)
    before_statuses = _statuses(client, board)
    rows = _mapping(
        "Zarząd,OTIF,,100,5,10,,,,,no",
        "Zarząd,Effort,2026-07-01,71.5,0.699301,1.398601,,,,,no",
    )

    result, written = convert(session, rows, actor_email=ACTOR, apply=True)
    session.commit()

    assert written is True
    after = _versions(session)
    assert after[: len(before_versions)] == before_versions
    twins = after[len(before_versions) :]
    assert len(twins) == len(result.proposals) == 6
    assert {twin[COLUMNS.index("recorded_by_email")] for twin in twins} == {ACTOR}
    assert all(twin[COLUMNS.index("target_value")] is not None for twin in twins)
    otif = next(p for p in result.proposals if p.metric.name == "OTIF")
    assert otif.reason == f"Conversion to target value: {RULE_MAPPING}"
    assert result.changes == []
    assert _statuses(client, board) == before_statuses
    # The twins are what judges the meeting now.
    tiles = board_of(client, board["team"]["id"], board["meeting"]["id"])["metrics"]
    assert all(tile["threshold"]["target_value"] is not None for tile in tiles)


def test_apply_writes_nothing_while_a_version_needs_a_mapping_row(
    client: TestClient, session: Session, board: Any
) -> None:
    before = _versions(session)

    result, written = convert(session, [], actor_email=ACTOR, apply=True)

    assert written is False
    assert result.refusals == ["2 version(s) need a mapping row"]
    assert _versions(session) == before


def test_apply_writes_nothing_while_a_status_change_is_not_accepted(
    client: TestClient, session: Session, board: Any
) -> None:
    before = _versions(session)
    # OTIF 92 turns red against 100 -5% -6%; Effort 71.5 stays green.
    rows = _mapping(
        "Zarząd,OTIF,,100,5,6,,,,,no",
        "Zarząd,Effort,,71.5,1,2,,,,,no",
    )

    result, written = convert(session, rows, actor_email=ACTOR, apply=True)

    assert written is False
    assert [(c.metric.name, c.before.value, c.after.value) for c in result.changes] == [
        ("OTIF", "amber", "red")
    ]
    assert _versions(session) == before


def test_a_converted_database_has_nothing_left_to_convert(
    client: TestClient, session: Session, board: Any
) -> None:
    rows = _mapping("Zarząd,OTIF,,100,5,10,,,,,no", "Zarząd,Effort,,71.5,1,2,,,,,no")
    convert(session, rows, actor_email=ACTOR, apply=True)
    session.commit()

    result, written = convert(session, [], actor_email=ACTOR, apply=True)

    assert (result.proposals, result.needs_mapping, written) == ([], [], True)


def test_a_mapping_naming_an_unknown_metric_is_refused(session: Session, board: Any) -> None:
    with pytest.raises(ConversionError, match="no metric named 'Nothing' on team 'Zarząd'"):
        convert(session, _mapping("Zarząd,Nothing,,1,0,0,,,,,no"), actor_email=ACTOR, apply=False)
