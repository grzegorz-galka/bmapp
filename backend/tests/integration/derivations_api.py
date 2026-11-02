"""Calls the derived-metrics tests share, made through the HTTP API."""

from typing import Any

from fastapi.testclient import TestClient

from tests.integration.metrics_api import add_metric


def sources(*pairs: tuple[str, str]) -> list[dict[str, str]]:
    """Sources as a request names them, from (team id, metric id) pairs."""
    return [{"team_id": team_id, "metric_id": metric_id} for team_id, metric_id in pairs]


def derivation(kind: str, *pairs: tuple[str, str]) -> dict[str, Any]:
    return {"kind": kind, "sources": sources(*pairs)}


def set_derivation(
    client: TestClient, team_id: str, metric_id: str, body: dict[str, Any] | None
) -> Any:
    """Set, replace or remove a metric's derivation; returns the raw response."""
    return client.patch(f"/teams/{team_id}/metrics/{metric_id}", json={"derivation": body})


def derived_metric(
    client: TestClient, team_id: str, name: str, kind: str, *pairs: tuple[str, str]
) -> Any:
    """Add a metric with a derivation and return it, failing the test if that is refused."""
    return add_metric(client, team_id, name, derivation=derivation(kind, *pairs))


def derive(client: TestClient, team_id: str, meeting_id: str, metric_id: str) -> Any:
    """Derive a metric's number at a meeting; returns the raw response."""
    return client.get(f"/teams/{team_id}/meetings/{meeting_id}/metrics/{metric_id}/derivation")


def derived(client: TestClient, team_id: str, meeting_id: str, metric_id: str) -> Any:
    """Derive a number and return the body, failing the test if that is refused."""
    response = derive(client, team_id, meeting_id, metric_id)
    assert response.status_code == 200, response.json()
    return response.json()


def errors_of(response: Any) -> list[tuple[str | None, str]]:
    """The field and code of every error a rejection carries, in order."""
    return [(error["field"], error["code"]) for error in response.json()["errors"]]


def named_sources(metric: Any) -> list[tuple[str, str]]:
    """A read metric's derivation sources as (team name, metric name), in order."""
    return [(s["team"]["name"], s["metric"]["name"]) for s in metric["derivation"]["sources"]]
