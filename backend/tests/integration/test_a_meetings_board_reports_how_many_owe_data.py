"""One test per scenario of "A meeting's board reports how many owe data".

In specs/meeting-readiness/spec.md. Today is pinned to Monday 12 October
2026; the meeting is on the Wednesday after.
"""

import json
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import dashboard_of, freeze_today, team_with
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, board_of
from tests.integration.pulse_api import answer, results_of
from tests.integration.teams_api import LEADER_EMAIL, member_id

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]

ANNA = "anna@example.com"
JAN = "jan@example.com"
EWA = "ewa@example.com"
OUTSIDER = "outsider@example.com"


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def test_the_board_and_the_dashboard_agree(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: The board and the dashboard agree.

    Anna owns two missing metrics and has answered, Jan owns one and has not,
    Ewa owns none and has not: three people, five gaps.
    """
    team = team_with(client, "Platform", ANNA, JAN, EWA)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    add_metric(client, team["id"], "Lead time", owner_employee_id=member_id(team, ANNA))
    add_metric(client, team["id"], "Open bugs", owner_employee_id=member_id(team, ANNA))
    add_metric(client, team["id"], "Deploys", owner_employee_id=member_id(team, JAN))
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])
    answer(client_as(ANNA), team["id"], meeting["id"])

    board = board_of(client_as(ANNA), team["id"], meeting["id"])
    (row,) = dashboard_of(client_as(ANNA))["meetings"]

    assert board["completeness"]["owing"] == 3
    assert (row["meeting_id"], row["owing"]) == (meeting["id"], 3)


def test_a_viewer_from_outside_the_team_gets_the_figure(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: A viewer from outside the team gets the figure."""
    team = team_with(client, "Platform", ANNA, JAN)
    team_with(client, "Payments", OUTSIDER)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    add_metric(client, team["id"], "Lead time", owner_employee_id=member_id(team, ANNA))
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])
    answer(client_as(ANNA), team["id"], meeting["id"])
    outsider = client_as(OUTSIDER)

    board = board_of(outsider, team["id"], meeting["id"])

    assert board["completeness"]["owing"] == 2
    assert JAN not in json.dumps(board)
    assert results_of(outsider, team["id"], meeting["id"])["missing"] is None
