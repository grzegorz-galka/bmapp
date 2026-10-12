"""The recorded half of "The hub shows the problem and task funnel" in specs/hub/spec.md.

The scenarios about how the funnel is displayed are the frontend's; these are
the two about what it counts.
"""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.hub_api import VIEWER, hub_of, team_with
from tests.integration.items_api import raise_problem, raise_task

ClientAs = Callable[[str], TestClient]


def test_the_funnel_counts_the_recorded_items_of_the_users_teams(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: The funnel counts the recorded items of the user's teams."""
    first = team_with(client, "Platform", VIEWER)
    second = team_with(client, "Payments", VIEWER)
    other = team_with(client, "Data Plane")
    raise_problem(client, first["id"], "Builds are flaky")
    raise_task(client, first["id"], "Split the test database", stage="do")
    raise_task(client, second["id"], "Retry the payment webhook", stage="do")
    raise_task(client, second["id"], "Check the retry worked", stage="check")
    for summary in ("Logs are lost", "Alerts are noisy", "Deploys are slow"):
        raise_problem(client, second["id"], summary, stage="act")
    raise_problem(client, other["id"], "Not the viewer's problem")
    raise_task(client, other["id"], "Not the viewer's task", stage="plan")

    funnel = hub_of(client_as(VIEWER))["funnel"]

    assert funnel["stages"] == [
        {"stage": "open", "problems": 1, "tasks": 0},
        {"stage": "in_progress", "problems": 0, "tasks": 3},
        {"stage": "archived", "problems": 3, "tasks": 0},
    ]
    assert funnel["scope_teams"] == 2


def test_a_user_on_no_team(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A user on no team."""
    other = team_with(client, "Platform")
    raise_problem(client, other["id"], "Builds are flaky")

    funnel = hub_of(client_as("nobody@example.com"))["funnel"]

    assert funnel["stages"] == [
        {"stage": "open", "problems": 0, "tasks": 0},
        {"stage": "in_progress", "problems": 0, "tasks": 0},
        {"stage": "archived", "problems": 0, "tasks": 0},
    ]
    assert funnel["scope_teams"] == 0
