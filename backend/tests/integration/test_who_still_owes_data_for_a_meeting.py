"""One test per scenario of "Who still owes data for a meeting".

In specs/meeting-readiness/spec.md. The figure is read from the board's
completeness, which reports `owing_by_meeting`; the people are the ones the
readiness panel merges from the board's missing owners and the pulse
results' missing members, so each test also pins the two definitions
together. Today is pinned to Monday 12 October 2026; the meeting is on the
Wednesday after.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.dashboard_api import freeze_today, team_with
from tests.integration.meetings_api import open_meeting
from tests.integration.metrics_api import add_metric, board_of, record
from tests.integration.pulse_api import answer, remove, results_of
from tests.integration.teams_api import LEADER_EMAIL, member_id

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]

ANNA = "anna@example.com"
JAN = "jan@example.com"


@pytest.fixture(autouse=True)
def _monday(monkeypatch: pytest.MonkeyPatch) -> None:
    freeze_today(monkeypatch)


def owing(client: TestClient, team_id: str, meeting_id: str) -> tuple[int, list[str]]:
    """How many owe data for a meeting, as its board reports, and who, as the panel merges them."""
    completeness = board_of(client, team_id, meeting_id)["completeness"]
    pulse = results_of(client, team_id, meeting_id)
    owners = {m["owner"]["email"] for m in completeness["missing"] if m["owner"]}
    unanswered = {m["email"] for m in pulse["missing"]}
    return completeness["owing"], sorted(owners | unanswered)


def test_a_person_with_two_gaps_counts_once(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A person with two gaps counts once."""
    team = team_with(client, "Platform", ANNA, JAN)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    anna = member_id(team, ANNA)
    add_metric(client, team["id"], "Lead time", owner_employee_id=anna)
    add_metric(client, team["id"], "Open bugs", owner_employee_id=anna)
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])

    assert owing(client, team["id"], meeting["id"]) == (2, [ANNA, JAN])


def test_a_metric_without_an_owner_adds_no_one(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A metric without an owner adds no one."""
    team = team_with(client, "Platform")
    meeting = open_meeting(client, team["id"], "2026-10-14")
    unowned = add_metric(client, team["id"], "Lead time")
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])

    completeness = board_of(client, team["id"], meeting["id"])["completeness"]

    assert owing(client, team["id"], meeting["id"]) == (0, [])
    assert completeness["missing"] == [
        {"metric_id": unowned["id"], "name": "Lead time", "owner": None}
    ]


def test_everything_is_in(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Everything is in.

    A comment without a number does not count as a value, and a retired
    metric without one owes nothing.
    """
    team = team_with(client, "Platform", ANNA)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    anna = member_id(team, ANNA)
    metric = add_metric(client, team["id"], "Lead time", owner_employee_id=anna)
    retired = add_metric(client, team["id"], "Old metric", owner_employee_id=anna)
    response = client.patch(f"/teams/{team['id']}/metrics/{retired['id']}", json={"retired": True})
    assert response.status_code == 200, response.json()
    record(client, team["id"], meeting["id"], metric["id"], comment="Waiting for data")
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])
    answer(client_as(ANNA), team["id"], meeting["id"])
    assert owing(client, team["id"], meeting["id"]) == (1, [ANNA])

    record(client, team["id"], meeting["id"], metric["id"], value="3")

    assert owing(client, team["id"], meeting["id"]) == (0, [])


def test_a_former_member_is_not_chased_for_the_pulse_check(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: A former member is not chased for the pulse check.

    Jan only owed an answer and is no longer chased; Anna also owns a metric
    still missing, so she still owes data after leaving.
    """
    team = team_with(client, "Platform", ANNA, JAN)
    meeting = open_meeting(client, team["id"], "2026-10-14")
    add_metric(client, team["id"], "Lead time", owner_employee_id=member_id(team, ANNA))
    answer(client_as(LEADER_EMAIL), team["id"], meeting["id"])
    assert owing(client, team["id"], meeting["id"]) == (2, [ANNA, JAN])

    remove(client, team["id"], JAN)
    remove(client, team["id"], ANNA)

    assert owing(client, team["id"], meeting["id"]) == (1, [ANNA])
