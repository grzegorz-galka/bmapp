"""One test per scenario of "A project's or product's metric may be a source".

In specs/derived-metrics/spec.md. Today is pinned to Monday 12 October
2026: CKI-P meets on the Wednesday after, Zarząd on the Thursday.
"""

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import freeze_today
from tests.integration.derivations_api import derive, derived, derived_metric, errors_of
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import metrics_of, record
from tests.integration.project_metrics_api import add_metric_of, set_active
from tests.integration.projects_api import add_project
from tests.integration.teams_api import register

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def _two_projects(client: TestClient) -> tuple[str, str, str, str]:
    """CKI-P with "Budget consumed" on PRJ-042 and PRJ-050: the team, the project, two metrics."""
    cki = register(client, "CKI-P")
    first = add_project(client, cki["id"], code="PRJ-042")
    second = add_project(client, cki["id"], code="PRJ-050")
    budget_42 = add_metric_of(client, cki["id"], "Budget consumed", project_id=first["id"])
    budget_50 = add_metric_of(client, cki["id"], "Budget consumed", project_id=second["id"])
    return cki["id"], first["id"], budget_42["id"], budget_50["id"]


def test_another_team_sums_two_projects(client: TestClient) -> None:
    """Scenario: Another team sums two projects."""
    cki, _, budget_42, budget_50 = _two_projects(client)
    board = register(client, "Zarząd", "zarzad-lead@example.com")
    total = derived_metric(
        client, board["id"], "Budget consumed (all)", "sum", (cki, budget_42), (cki, budget_50)
    )
    cki_meeting = open_meeting(client, cki, "2026-10-14")
    board_meeting = open_meeting(client, board["id"], "2026-10-15")
    record(client, cki, cki_meeting["id"], budget_42, value="40")
    record(client, cki, cki_meeting["id"], budget_50, value="60.5")

    result = derived(client, board["id"], board_meeting["id"], total["id"])

    assert result["value"] == "100.5"
    assert [
        (s["team"]["name"], s["metric"]["project"]["code"], s["metric"]["name"], s["meeting_id"])
        for s in result["sources"]
    ] == [
        ("CKI-P", "PRJ-042", "Budget consumed", cki_meeting["id"]),
        ("CKI-P", "PRJ-050", "Budget consumed", cki_meeting["id"]),
    ]
    (listed,) = metrics_of(client, board["id"])
    assert [s["metric"]["project"]["code"] for s in listed["derivation"]["sources"]] == [
        "PRJ-042",
        "PRJ-050",
    ]


def test_a_source_from_an_inactive_project(client: TestClient) -> None:
    """Scenario: A source from an inactive project."""
    cki, first, budget_42, budget_50 = _two_projects(client)
    board = register(client, "Zarząd", "zarzad-lead@example.com")
    total = derived_metric(
        client, board["id"], "Budget consumed (all)", "sum", (cki, budget_42), (cki, budget_50)
    )
    cki_meeting = open_meeting(client, cki, "2026-10-14")
    board_meeting = open_meeting(client, board["id"], "2026-10-15")
    set_active(client, cki, "projects", first, False)
    record(client, cki, cki_meeting["id"], budget_50, value="60")

    response = derive(client, board["id"], board_meeting["id"], total["id"])

    assert response.status_code == 409
    assert errors_of(response) == [("sources[0]", "derivation.source_missing")]
    (listed,) = metrics_of(client, board["id"])
    assert [
        (s["metric"]["id"], s["metric"]["project"]["active"])
        for s in listed["derivation"]["sources"]
    ] == [
        (budget_42, False),
        (budget_50, True),
    ]
