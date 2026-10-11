"""One test per scenario of "List the global metrics" in specs/global-metrics/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_api import (
    add_global,
    add_global_threshold,
    catalogue,
    include,
)
from tests.integration.metrics_api import MONDAY
from tests.integration.teams_api import register


def test_the_catalogue_is_listed(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: The catalogue is listed."""
    monkeypatch.setattr("app.api.global_metrics.today", lambda: MONDAY)
    security = add_global(client, "Security findings", direction="lower_is_better")
    availability = add_global(client, "Availability")
    add_global_threshold(client, availability["id"], "2026-01-01", green="99", amber="98")
    # Not yet in force today, so not the one listed.
    add_global_threshold(client, availability["id"], "2026-11-01", green="99.5", amber="99")
    for name in ("Alpha", "Beta"):
        team = register(client, name, f"lead.{name.lower()}@example.com")
        include(session, team["id"], availability["id"])

    listing = catalogue(client)

    assert [(m["name"], m["boards"]) for m in listing] == [
        ("Availability", 2),
        ("Security findings", 0),
    ]
    threshold = listing[0]["threshold"]
    assert (threshold["effective_from"], threshold["green_lo"], threshold["amber_lo"]) == (
        "2026-01-01",
        "99",
        "98",
    )
    assert listing[1]["threshold"] is None
    assert listing[1]["id"] == security["id"]
