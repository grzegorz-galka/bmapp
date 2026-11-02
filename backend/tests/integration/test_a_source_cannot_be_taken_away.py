"""One test per scenario of "A source cannot be taken away" in specs/derived-metrics/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.derivations_api import derive, derived_metric, errors_of
from tests.integration.global_metrics_seed import include, seed_global_metric
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, freeze_today, metrics_of, record
from tests.integration.teams_api import register

LEADER = "lead.zarzad@pse.pl"


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """The team Zarząd, led by LEADER; today is Monday the 12th."""
    freeze_today(monkeypatch)
    return str(register(client, "Zarząd", LEADER)["id"])


def test_deleting_a_source_is_refused(
    client: TestClient, client_as: Callable[[str], TestClient], team: str
) -> None:
    """Scenario: Deleting a source is refused."""
    source = add_metric(client, team, "Zatrudnienie")
    delta = derived_metric(client, team, "Zatrudnienie delta", "delta", (team, source["id"]))
    before = metrics_of(client, team)

    response = client_as(LEADER).delete(f"/teams/{team}/metrics/{source['id']}")

    assert response.status_code == 409
    assert errors_of(response) == [(None, "metric.derivation_source")]
    assert metrics_of(client, team) == before
    # Once the derivation no longer reads it, it goes.
    client.delete(f"/teams/{team}/metrics/{delta['id']}")
    assert client_as(LEADER).delete(f"/teams/{team}/metrics/{source['id']}").status_code == 204


def test_removing_an_included_global_source_is_refused(
    client: TestClient, client_as: Callable[[str], TestClient], session: Session, team: str
) -> None:
    """Scenario: Removing an included global source is refused."""
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    availability = seed_global_metric(session)
    include(client, team, availability)
    include(client, other, availability)
    derived_metric(client, team, "Availability mean", "mean", (team, availability))

    response = client_as(LEADER).delete(f"/teams/{team}/metrics/{availability}")
    from_the_catalogue = client.delete(f"/global-metrics/{availability}")

    assert response.status_code == from_the_catalogue.status_code == 409
    assert (
        errors_of(response) == errors_of(from_the_catalogue) == [(None, "metric.derivation_source")]
    )
    assert availability in [m["id"] for m in metrics_of(client, team)]
    # Another board, where no derivation reads it, removes it as before.
    assert client.delete(f"/teams/{other}/metrics/{availability}").status_code == 204


def test_a_retired_source_leaves_the_derivation_missing_a_number(
    client: TestClient, client_as: Callable[[str], TestClient], team: str
) -> None:
    """Scenario: A retired source leaves the derivation missing a number."""
    kept = add_metric(client, team, "Kept")
    retired = add_metric(client, team, "Retired")
    total = derived_metric(client, team, "Total", "sum", (team, kept["id"]), (team, retired["id"]))
    meeting = open_meeting(client, team, "2026-10-14")
    record(client, team, meeting["id"], kept["id"], value="1")
    # Recorded before it was retired: a retired metric still gives no number.
    record(client, team, meeting["id"], retired["id"], value="2")

    retiring = client_as(LEADER).patch(
        f"/teams/{team}/metrics/{retired['id']}", json={"retired": True}
    )
    response = derive(client, team, meeting["id"], total["id"])

    assert retiring.status_code == 200
    assert response.status_code == 409
    assert errors_of(response) == [("sources[1]", "derivation.source_missing")]


def test_a_copy_has_no_derivation(client: TestClient, team: str) -> None:
    """Scenario: A copy has no derivation."""
    other = register(client, "CKI-P", "lead.ckip@pse.pl")["id"]
    source = add_metric(client, team, "Source")
    total = derived_metric(client, team, "Total", "sum", (team, source["id"]))

    response = client.post(f"/teams/{other}/metrics/copies", json={"source_metric_id": total["id"]})

    assert response.status_code == 201
    assert response.json()["derivation"] is None
    [kept] = [m for m in metrics_of(client, team) if m["id"] == total["id"]]
    assert kept["derivation"] == total["derivation"]
