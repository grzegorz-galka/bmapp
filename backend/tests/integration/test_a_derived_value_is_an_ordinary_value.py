"""One test per scenario of "A derived value is an ordinary value".

In specs/derived-metrics/spec.md.
"""

import pytest
from fastapi.testclient import TestClient

from tests.integration.derivations_api import derived, derived_metric
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, board_of, freeze_today, record, tile
from tests.integration.teams_api import register

UNITS = ["BPW", "CKBiR", "CKI-P", "CKS", "CKT", "CKI-S"]
NUMBERS = ["90", "97", "87", "83", "105", "101"]


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """The team Zarząd; today is Monday the 12th."""
    freeze_today(monkeypatch)
    return str(register(client, "Zarząd", "lead.zarzad@pse.pl")["id"])


def test_a_source_is_corrected_after_the_value_was_recorded(client: TestClient, team: str) -> None:
    """Scenario: A source is corrected after the value was recorded."""
    units = [add_metric(client, team, f"OTIF E: {unit}")["id"] for unit in UNITS]
    otif = derived_metric(client, team, "OTIF E", "mean", *((team, unit) for unit in units))
    meeting = open_meeting(client, team, "2026-10-14")
    for unit, number in zip(units, NUMBERS, strict=True):
        record(client, team, meeting["id"], unit, value=number)
    number = derived(client, team, meeting["id"], otif["id"])["value"]
    record(client, team, meeting["id"], otif["id"], value=number)

    record(client, team, meeting["id"], units[0], value="96")

    assert tile(board_of(client, team, meeting["id"]), otif["id"])["value"] == "93.833333"
    assert derived(client, team, meeting["id"], otif["id"])["value"] == "94.833333"


def test_a_derived_metric_still_counts_as_missing(client: TestClient, team: str) -> None:
    """Scenario: A derived metric still counts as missing."""
    source = add_metric(client, team, "Source")
    copy = derived_metric(client, team, "Copy", "mean", (team, source["id"]))
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, meeting["id"], source["id"], value="5")

    completeness = board_of(client, team, meeting["id"])["completeness"]

    assert (completeness["recorded"], completeness["total"]) == (1, 2)
    assert [m["metric_id"] for m in completeness["missing"]] == [copy["id"]]
