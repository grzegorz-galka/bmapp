"""One test per scenario of "Define a metric's derivation" in specs/derived-metrics/spec.md."""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.derivations_api import (
    derivation,
    derived_metric,
    errors_of,
    named_sources,
    set_derivation,
)
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import (
    add_metric,
    board_of,
    freeze_today,
    metrics_of,
    record,
    tile,
    trend_of,
)
from tests.integration.teams_api import add, register

LEADER = "lead.zarzad@pse.pl"
MEMBER = "member.zarzad@pse.pl"
UNITS = ["BPW", "CKBiR", "CKI-P", "CKS", "CKT", "CKI-S"]


@pytest.fixture
def zarzad(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """The team Zarząd, led by LEADER; today is Monday the 12th."""
    freeze_today(monkeypatch)
    return str(register(client, "Zarząd", LEADER)["id"])


def _unchanged(client: TestClient, team_id: str, before: dict[str, object]) -> None:
    [after] = [m for m in metrics_of(client, team_id) if m["id"] == before["id"]]
    assert after == before


def test_a_mean_of_six_metrics(
    client: TestClient, client_as: Callable[[str], TestClient], zarzad: str
) -> None:
    """Scenario: A mean of six metrics."""
    units = [add_metric(client, zarzad, f"OTIF E: {unit}")["id"] for unit in UNITS]
    otif = add_metric(client, zarzad, "OTIF E")

    response = set_derivation(
        client_as(LEADER),
        zarzad,
        otif["id"],
        derivation("mean", *((zarzad, unit) for unit in units)),
    )

    assert response.status_code == 200, response.json()
    read = response.json()
    assert read["derivation"]["kind"] == "mean"
    assert named_sources(read) == [("Zarząd", f"OTIF E: {unit}") for unit in UNITS]
    assert [s["metric"]["id"] for s in read["derivation"]["sources"]] == units
    assert {s["team"]["id"] for s in read["derivation"]["sources"]} == {zarzad}
    [listed] = [m for m in metrics_of(client, zarzad) if m["id"] == otif["id"]]
    assert listed["derivation"] == read["derivation"]
    meeting = open_meeting(client, zarzad, "2026-10-14")
    assert (
        tile(board_of(client, zarzad, meeting["id"]), otif["id"])["metric"]["derivation"]
        == (read["derivation"])
    )


def test_a_value_taken_from_another_team(
    client: TestClient, client_as: Callable[[str], TestClient], zarzad: str
) -> None:
    """Scenario: A value taken from another team."""
    cki_p = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    etap = add_metric(client, cki_p, "OTIF-Etap")
    copied = add_metric(client, zarzad, "OTIF E: CKI-P")

    response = set_derivation(
        client_as(LEADER), zarzad, copied["id"], derivation("mean", (cki_p, etap["id"]))
    )

    assert response.status_code == 200, response.json()
    assert response.json()["derivation"]["kind"] == "mean"
    assert named_sources(response.json()) == [("CKI-P", "OTIF-Etap")]
    [source] = response.json()["derivation"]["sources"]
    assert (source["team"]["id"], source["metric"]["id"]) == (cki_p, etap["id"])


def test_a_metric_added_with_a_derivation(
    client_as: Callable[[str], TestClient], zarzad: str
) -> None:
    """Scenario: A metric added with a derivation."""
    leader = client_as(LEADER)
    headcount = add_metric(leader, zarzad, "Zatrudnienie")

    added = derived_metric(leader, zarzad, "Zatrudnienie delta", "delta", (zarzad, headcount["id"]))

    assert added["derivation"]["kind"] == "delta"
    assert named_sources(added) == [("Zarząd", "Zatrudnienie")]
    [listed] = [m for m in metrics_of(leader, zarzad) if m["id"] == added["id"]]
    assert listed == added


def test_a_derivation_is_removed(client: TestClient, zarzad: str) -> None:
    """Scenario: A derivation is removed."""
    source = add_metric(client, zarzad, "Orders")
    total = derived_metric(client, zarzad, "Total", "sum", (zarzad, source["id"]))
    meeting = open_meeting(client, zarzad, "2026-10-14")
    record(client, zarzad, meeting["id"], total["id"], value="12")

    response = set_derivation(client, zarzad, total["id"], None)

    assert response.status_code == 200, response.json()
    assert response.json()["derivation"] is None
    assert [p["value"] for p in trend_of(client, zarzad, total["id"])["points"]] == ["12"]
    # Removing it again is no change.
    assert set_derivation(client, zarzad, total["id"], None).json()["derivation"] is None


def test_a_derivation_is_changed(client: TestClient, zarzad: str) -> None:
    """Scenario: A derivation is changed."""
    first = add_metric(client, zarzad, "First")
    second = add_metric(client, zarzad, "Second")
    total = derived_metric(client, zarzad, "Total", "sum", (zarzad, first["id"]))
    meeting = open_meeting(client, zarzad, "2026-10-14")
    record(client, zarzad, meeting["id"], total["id"], value="12")

    # The same source kept, reordered behind a new one, under another kind.
    response = set_derivation(
        client,
        zarzad,
        total["id"],
        derivation("mean", (zarzad, second["id"]), (zarzad, first["id"])),
    )

    assert response.status_code == 200, response.json()
    assert response.json()["derivation"]["kind"] == "mean"
    assert named_sources(response.json()) == [("Zarząd", "Second"), ("Zarząd", "First")]
    assert [p["value"] for p in trend_of(client, zarzad, total["id"])["points"]] == ["12"]


@pytest.mark.parametrize(("kind", "count"), [("delta", 2), ("delta", 0), ("mean", 0), ("sum", 0)])
def test_wrong_number_of_sources(client: TestClient, zarzad: str, kind: str, count: int) -> None:
    """Scenario: Wrong number of sources."""
    first = add_metric(client, zarzad, "First")
    second = add_metric(client, zarzad, "Second")
    target = add_metric(client, zarzad, "Target")
    pairs = [(zarzad, first["id"]), (zarzad, second["id"])][:count]

    response = set_derivation(client, zarzad, target["id"], derivation(kind, *pairs))
    created = client.post(
        f"/teams/{zarzad}/metrics",
        json={
            "name": "New",
            "direction": "higher_is_better",
            "derivation": derivation(kind, *pairs),
        },
    )

    assert response.status_code == created.status_code == 422
    assert (
        errors_of(response)
        == errors_of(created)
        == [("derivation.sources", "derivation.source_count")]
    )
    _unchanged(client, zarzad, target)
    assert "New" not in [m["name"] for m in metrics_of(client, zarzad)]


def test_a_source_that_is_not_on_the_named_board(client: TestClient, zarzad: str) -> None:
    """Scenario: A source that is not on the named board."""
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    theirs = add_metric(client, other, "OTIF-Etap")
    ours = add_metric(client, zarzad, "Ours")
    target = add_metric(client, zarzad, "Target")

    on_the_wrong_board = set_derivation(
        client,
        zarzad,
        target["id"],
        derivation("sum", (zarzad, ours["id"]), (zarzad, theirs["id"])),
    )
    no_such_team = set_derivation(
        client, zarzad, target["id"], derivation("sum", (str(uuid.uuid4()), ours["id"]))
    )

    assert on_the_wrong_board.status_code == no_such_team.status_code == 422
    assert errors_of(on_the_wrong_board) == [
        ("derivation.sources[1]", "derivation_source.not_found")
    ]
    assert errors_of(no_such_team) == [("derivation.sources[0]", "derivation_source.not_found")]
    _unchanged(client, zarzad, target)


def test_a_metric_as_its_own_source(client: TestClient, zarzad: str) -> None:
    """Scenario: A metric as its own source."""
    other = add_metric(client, zarzad, "Other")
    target = add_metric(client, zarzad, "Target")

    response = set_derivation(
        client,
        zarzad,
        target["id"],
        derivation("mean", (zarzad, other["id"]), (zarzad, target["id"])),
    )

    assert response.status_code == 422
    assert errors_of(response) == [("derivation.sources[1]", "derivation_source.self")]
    _unchanged(client, zarzad, target)


def test_the_same_source_twice(client: TestClient, zarzad: str) -> None:
    """Scenario: The same source twice."""
    first = add_metric(client, zarzad, "First")
    second = add_metric(client, zarzad, "Second")
    target = add_metric(client, zarzad, "Target")

    response = set_derivation(
        client,
        zarzad,
        target["id"],
        derivation("sum", (zarzad, first["id"]), (zarzad, second["id"]), (zarzad, first["id"])),
    )

    assert response.status_code == 422
    assert errors_of(response) == [("derivation.sources[2]", "derivation_source.duplicate")]
    _unchanged(client, zarzad, target)


def test_only_whoever_configures_the_board_sets_a_derivation(
    client: TestClient, client_as: Callable[[str], TestClient], zarzad: str
) -> None:
    """Scenario: Only whoever configures the board sets a derivation."""
    add(client, zarzad, MEMBER)
    source = add_metric(client, zarzad, "Source")
    target = add_metric(client, zarzad, "Target")
    member = client_as(MEMBER)

    changed = set_derivation(
        member, zarzad, target["id"], derivation("sum", (zarzad, source["id"]))
    )
    created = member.post(
        f"/teams/{zarzad}/metrics",
        json={
            "name": "New",
            "direction": "higher_is_better",
            "derivation": derivation("sum", (zarzad, source["id"])),
        },
    )

    assert changed.status_code == created.status_code == 403
    assert errors_of(changed) == errors_of(created) == [(None, "auth.forbidden")]
    _unchanged(client, zarzad, target)
    assert "New" not in [m["name"] for m in metrics_of(client, zarzad)]
