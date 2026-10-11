"""One test per scenario of "The viewer's own answer" in specs/pulse-check/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.integration.meetings_api import open_meeting
from tests.integration.pulse_api import answer, freeze_today, results_of, team_of


def test_a_member_sees_their_own_answer(
    client: TestClient, client_as: Callable[[str], TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario: A member sees their own answer."""
    freeze_today(monkeypatch)
    team_id, (lead, member, _) = team_of(client, 3)
    meeting = open_meeting(client, team_id, "2026-10-14")["id"]
    answer(client_as(lead), team_id, meeting, 2)
    own = answer(client_as(member), team_id, meeting, 4, better="Pair more")

    results = results_of(client_as(member), team_id, meeting)

    assert results["own"] == own
    assert results_of(client, team_id, meeting)["own"] is None
