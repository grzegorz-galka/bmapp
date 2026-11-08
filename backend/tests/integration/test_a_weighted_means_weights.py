"""One test per scenario of "A weighted mean's weights" in specs/derived-metrics/spec.md."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.derivations_api import (
    Source,
    derivation,
    errors_of,
    set_derivation,
    weights_of,
)
from tests.integration.metrics_api import add_metric, freeze_today, metrics_of
from tests.integration.teams_api import register


@pytest.fixture
def team(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """The team Zarząd; today is Monday the 12th."""
    freeze_today(monkeypatch)
    return str(register(client, "Zarząd", "lead.zarzad@pse.pl")["id"])


@pytest.fixture
def three(client: TestClient, team: str) -> list[str]:
    """Three metrics on the team's board, to be weighted."""
    return [add_metric(client, team, f"OTIF E: {unit}")["id"] for unit in ("BPW", "CKBiR", "CKS")]


def _rejected(
    client: TestClient, team: str, kind: str, sources: list[Source]
) -> list[tuple[str | None, str]]:
    """Set the derivation on an existing metric and when adding one; both must be refused alike.

    Returns the errors, after checking that neither metric changed.
    """
    target = add_metric(client, team, "Target")
    changed = set_derivation(client, team, target["id"], derivation(kind, *sources))
    created = client.post(
        f"/teams/{team}/metrics",
        json={
            "name": "New",
            "direction": "higher_is_better",
            "derivation": derivation(kind, *sources),
        },
    )
    assert changed.status_code == created.status_code == 422
    assert errors_of(changed) == errors_of(created)
    listed = metrics_of(client, team)
    assert [m for m in listed if m["id"] == target["id"]] == [target]
    assert "New" not in [m["name"] for m in listed]
    return errors_of(changed)


def test_a_source_without_a_weight(client: TestClient, team: str, three: list[str]) -> None:
    """Scenario: A source without a weight."""
    first, second, third = three

    errors = _rejected(
        client, team, "weighted_mean", [(team, first, "3"), (team, second), (team, third, "1")]
    )

    assert errors == [("derivation.sources[1].weight", "derivation_source.weight_required")]


@pytest.mark.parametrize("weight", ["0", "-1", "0.0000001", "1000000000000000"])
def test_a_weight_of_zero_or_less(
    client: TestClient, team: str, three: list[str], weight: str
) -> None:
    """Scenario: A weight of zero or less.

    A weight finer than 6 places, or too large to store, is refused the same way.
    """
    first, second, _ = three

    errors = _rejected(client, team, "weighted_mean", [(team, first, "1"), (team, second, weight)])

    assert errors == [("derivation.sources[1].weight", "derivation_source.weight_invalid")]


@pytest.mark.parametrize("kind", ["mean", "sum", "delta"])
def test_a_weight_on_another_kind(
    client: TestClient, team: str, three: list[str], kind: str
) -> None:
    """Scenario: A weight on another kind."""
    first, *_ = three

    errors = _rejected(client, team, kind, [(team, first, "1")])

    assert errors == [("derivation.sources[0].weight", "derivation_source.weight_invalid")]


def test_fractional_weights(client: TestClient, team: str, three: list[str]) -> None:
    """Scenario: Fractional weights."""
    target = add_metric(client, team, "Target")
    weights = ["0.6", "0.25", "0.15"]

    response = set_derivation(
        client,
        team,
        target["id"],
        derivation(
            "weighted_mean",
            *((team, metric, weight) for metric, weight in zip(three, weights, strict=True)),
        ),
    )

    assert response.status_code == 200, response.json()
    assert weights_of(response.json()) == weights
    [listed] = [m for m in metrics_of(client, team) if m["id"] == target["id"]]
    assert weights_of(listed) == weights
