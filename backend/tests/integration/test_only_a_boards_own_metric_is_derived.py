"""One test per scenario of "Only a board's own metric is derived".

In specs/derived-metrics/spec.md.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.derivations_api import (
    derivation,
    derived,
    derived_metric,
    errors_of,
    named_sources,
    set_derivation,
)
from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, freeze_today, metrics_of, record
from tests.integration.teams_api import register

LEADER = "lead.zarzad@pse.pl"


def test_a_global_metric_is_not_derived(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario: A global metric is not derived."""
    freeze_today(monkeypatch)
    team = register(client, "Zarząd", LEADER)["id"]
    source = add_metric(client, team, "Source")
    availability = include(client, team, seed_global_metric(session))
    before = metrics_of(client, team)

    response = set_derivation(
        client_as(LEADER), team, availability["id"], derivation("mean", (team, source["id"]))
    )

    assert response.status_code == 409
    assert errors_of(response) == [("derivation", "global_metric.read_only")]
    assert metrics_of(client, team) == before
    # Repeating "no derivation" is no change, as repeating a name is not.
    unchanged = set_derivation(client_as(LEADER), team, availability["id"], None)
    assert unchanged.status_code == 200
    assert unchanged.json()["derivation"] is None


def test_a_global_metric_as_a_source(
    client: TestClient,
    client_as: Callable[[str], TestClient],
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario: A global metric as a source."""
    freeze_today(monkeypatch)
    zarzad = register(client, "Zarząd", LEADER)["id"]
    cki_p = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    other = register(client, "CKS", "lead.cks@pse.pl")["id"]
    etap = seed_global_metric(session, "OTIF-Etap")
    include(client, cki_p, etap)
    include(client, other, etap)

    copied = derived_metric(client_as(LEADER), zarzad, "OTIF E: CKI-P", "mean", (cki_p, etap))

    assert named_sources(copied) == [("CKI-P", "OTIF-Etap")]
    theirs = open_meeting(client, cki_p, "2026-10-13")
    elsewhere = open_meeting(client, other, "2026-10-13")
    ours = open_meeting(client, zarzad, "2026-10-14")
    record(client, cki_p, theirs["id"], etap, value="96.5")
    record(client, other, elsewhere["id"], etap, value="12")
    result = derived(client, zarzad, ours["id"], copied["id"])
    assert result["value"] == "96.5"
    assert result["sources"][0]["meeting_id"] == theirs["id"]
