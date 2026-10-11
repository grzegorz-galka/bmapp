"""One test per scenario of "Thresholds of a global metric" in specs/global-metrics/spec.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.global_metrics_api import (
    add_global,
    add_global_threshold,
    global_thresholds_of,
    include,
)
from tests.integration.meetings_api import error_of, open_meeting
from tests.integration.metrics_api import freeze_today, record, thresholds_of
from tests.integration.teams_api import register


def test_one_threshold_judges_every_board(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: One threshold judges every board."""
    freeze_today(monkeypatch)
    metric = add_global(client, "Service availability", decimals=2)
    version = add_global_threshold(client, metric["id"], "2026-10-01", green="99.5", amber="99")
    statuses = []
    for name in ("Alpha", "Beta"):
        team = register(client, name, f"lead.{name.lower()}@example.com")
        include(session, team["id"], metric["id"])
        meeting = open_meeting(client, team["id"], "2026-10-14")
        statuses.append(
            record(client, team["id"], meeting["id"], metric["id"], value="99.2")["status"]
        )
        assert thresholds_of(client, team["id"], metric["id"]) == [version]

    assert statuses == ["amber", "amber"]
    assert global_thresholds_of(client, metric["id"]) == [version]


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"green": "99", "amber": "99.5", "reason": "Plan"}, (None, "threshold.order_invalid")),
        ({"green": "99.5", "amber": "99", "reason": "  "}, ("reason", "threshold_reason.blank")),
    ],
)
def test_invalid_versions_are_refused_as_for_a_boards_metric(
    client: TestClient, body: dict[str, str], error: tuple[str | None, str]
) -> None:
    """Scenario: Invalid versions are refused as for a board's metric."""
    metric = add_global(client, "Service availability", direction="higher_is_better")

    response = client.post(
        f"/global-metrics/{metric['id']}/thresholds", json={"effective_from": "2026-10-01", **body}
    )

    assert response.status_code == 422
    assert error_of(response) == error
    assert global_thresholds_of(client, metric["id"]) == []
