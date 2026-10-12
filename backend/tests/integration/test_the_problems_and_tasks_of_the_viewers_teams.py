"""The API half of "The problems and tasks of the viewer's teams" in specs/dashboard/spec.md.

One test per scenario. How the figures are displayed is the frontend's;
these are about what the summary counts.
"""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.dashboard_api import VIEWER, dashboard_of, team_with
from tests.integration.items_api import raise_problem, raise_task

ClientAs = Callable[[str], TestClient]


def test_each_stage_shows_its_figures(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: Each stage shows its figures - as a code and two counts per stage."""
    team = team_with(client, "Platform", VIEWER)
    raise_problem(client, team["id"], "Builds are flaky")
    raise_task(client, team["id"], "Split the test database", stage="plan")

    stages = dashboard_of(client_as(VIEWER))["funnel"]["stages"]

    assert stages == [
        {"stage": "open", "problems": 1, "tasks": 0},
        {"stage": "in_progress", "problems": 0, "tasks": 1},
        {"stage": "archived", "problems": 0, "tasks": 0},
    ]


def test_the_figures_count_the_recorded_items_of_the_viewers_teams(
    client: TestClient, client_as: ClientAs
) -> None:
    """Scenario: The figures count the recorded items of the viewer's teams."""
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

    funnel = dashboard_of(client_as(VIEWER))["funnel"]

    assert funnel["stages"] == [
        {"stage": "open", "problems": 1, "tasks": 0},
        {"stage": "in_progress", "problems": 0, "tasks": 3},
        {"stage": "archived", "problems": 3, "tasks": 0},
    ]
    assert funnel["scope_teams"] == 2


def test_a_viewer_on_no_team_sees_zeros(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A viewer on no team sees zeros."""
    other = team_with(client, "Platform")
    raise_problem(client, other["id"], "Builds are flaky")

    funnel = dashboard_of(client_as("nobody@example.com"))["funnel"]

    assert funnel["stages"] == [
        {"stage": "open", "problems": 0, "tasks": 0},
        {"stage": "in_progress", "problems": 0, "tasks": 0},
        {"stage": "archived", "problems": 0, "tasks": 0},
    ]
    assert funnel["scope_teams"] == 0
