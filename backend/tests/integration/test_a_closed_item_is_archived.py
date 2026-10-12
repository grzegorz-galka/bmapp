"""One test per scenario of "A closed item is archived" in specs/problems-and-tasks/spec.md."""

import datetime
import threading
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.exceptions import ProblemArchivedError
from app.core.item_enums import Stage
from app.models import Problem, Team
from app.schemas import ProblemChange
from app.services.problems import change_problem
from tests.integration.items_api import (
    MONDAY,
    Kind,
    change,
    freeze_today,
    items_of,
    patch_item,
    raise_problem,
    raise_task,
)
from tests.integration.meetings_api import error_of
from tests.integration.teams_api import register


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    freeze_today(monkeypatch)
    return register(client)


def test_closing_archives(client: TestClient, team: dict[str, Any]) -> None:
    """Scenario: Closing archives."""
    problem = raise_problem(client, team["id"], stage="check")

    closed = change(client, team["id"], "problems", problem["id"], stage="act")

    assert (closed["stage"], closed["archived"]) == ("act", True)
    assert closed["closed_at"] is not None
    assert closed["closed_at"] >= closed["raised_at"]
    assert items_of(client, team["id"], "problems") == []
    assert [p["id"] for p in items_of(client, team["id"], "problems", "archived")] == [
        problem["id"]
    ]


def test_an_item_raised_as_done_is_archived_at_once(
    client: TestClient, team: dict[str, Any]
) -> None:
    """Scenario: An item raised as done is archived at once."""
    task = raise_task(client, team["id"], stage="act")

    assert (task["stage"], task["archived"]) == ("act", True)
    assert task["closed_at"] == task["raised_at"]
    assert items_of(client, team["id"], "tasks") == []
    assert items_of(client, team["id"], "tasks", "archived") == [task]


@pytest.mark.parametrize("fields", [{"summary": "Reopened"}, {"stage": "do"}, {"stage": "act"}])
def test_an_archived_item_cannot_be_changed(
    client: TestClient, team: dict[str, Any], fields: dict[str, str]
) -> None:
    """Scenario: An archived item cannot be changed."""
    task = change(client, team["id"], "tasks", raise_task(client, team["id"])["id"], stage="act")

    response = patch_item(client, team["id"], "tasks", task["id"], **fields)

    assert response.status_code == 409
    assert error_of(response) == (None, "task.archived")
    assert items_of(client, team["id"], "tasks", "archived") == [task]


@pytest.mark.parametrize("kind", ["problems", "tasks"])
@pytest.mark.parametrize("stage", ["plan", "act"])
def test_there_is_no_way_to_delete_an_item(
    client: TestClient, team: dict[str, Any], kind: Kind, stage: str
) -> None:
    """Scenario: There is no way to delete an item."""
    raise_item = raise_problem if kind == "problems" else raise_task
    item = raise_item(client, team["id"], stage=stage)

    response = client.delete(f"/teams/{team['id']}/{kind}/{item['id']}")

    assert response.status_code == 405
    state = "archived" if stage == "act" else "active"
    assert items_of(client, team["id"], kind, state) == [item]


def test_two_members_closing_at_once_take_turns(engine: Engine) -> None:
    """The row lock: a close waits for one in flight, then is told the item is archived.

    Two real connections, so this commits its own rows and removes them
    afterwards rather than relying on the rolled-back test transaction.
    """
    now = datetime.datetime.now(datetime.UTC)
    with Session(engine) as setup:
        team = Team(name=f"Concurrency {uuid.uuid4()}")
        setup.add(team)
        setup.flush()
        problem = Problem(team_id=team.id, summary="Builds are flaky", raised_at=now)
        setup.add(problem)
        setup.commit()
        team_id, problem_id = team.id, problem.id

    outcome: list[BaseException | None] = []

    def close_second() -> None:
        with Session(engine) as second:
            try:
                change_problem(
                    second, team_id, problem_id, ProblemChange(stage=Stage.ACT), "b@x.pl", MONDAY
                )
                outcome.append(None)
            except ProblemArchivedError as error:
                outcome.append(error)

    try:
        with Session(engine) as first:
            locked = first.scalars(
                select(Problem).where(Problem.id == problem_id).with_for_update(of=Problem)
            ).one()
            locked.stage, locked.closed_at = Stage.ACT, now
            first.flush()

            racer = threading.Thread(target=close_second)
            racer.start()
            racer.join(timeout=0.5)
            assert racer.is_alive(), "the second close did not wait for the first"
            first.commit()
        racer.join(timeout=10)

        assert len(outcome) == 1
        assert isinstance(outcome[0], ProblemArchivedError)
    finally:
        with Session(engine) as cleanup:
            cleanup.execute(delete(Team).where(Team.id == team_id))
            cleanup.commit()
