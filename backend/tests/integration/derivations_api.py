"""Calls the derived-metrics tests share, made through the HTTP API."""

from typing import Any

from fastapi.testclient import TestClient

from tests.integration.metrics_api import add_metric

#: A source as a test names it: (team id, metric id), or with a weight after them.
Source = tuple[str, str] | tuple[str, str, str]


def sources(*pairs: Source) -> list[dict[str, str]]:
    """Sources as a request names them, from (team id, metric id[, weight]) tuples."""
    return [
        {"team_id": pair[0], "metric_id": pair[1]} | ({"weight": pair[2]} if len(pair) > 2 else {})
        for pair in pairs
    ]


def derivation(kind: str, *pairs: Source) -> dict[str, Any]:
    return {"kind": kind, "sources": sources(*pairs)}


def weighted(*pairs: tuple[str, str], weight: str = "1") -> tuple[Source, ...]:
    """The same sources, each given `weight`: what a weighted mean needs to be accepted."""
    return tuple((team_id, metric_id, weight) for team_id, metric_id in pairs)


def set_derivation(
    client: TestClient, team_id: str, metric_id: str, body: dict[str, Any] | None
) -> Any:
    """Set, replace or remove a metric's derivation; returns the raw response."""
    return client.patch(f"/teams/{team_id}/metrics/{metric_id}", json={"derivation": body})


def derived_metric(client: TestClient, team_id: str, name: str, kind: str, *pairs: Source) -> Any:
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


def weights_of(metric: Any) -> list[str | None]:
    """A read metric's derivation weights, in source order."""
    return [s["weight"] for s in metric["derivation"]["sources"]]


def named_sources(metric: Any) -> list[tuple[str, str]]:
    """A read metric's derivation sources as (team name, metric name), in order."""
    return [(s["team"]["name"], s["metric"]["name"]) for s in metric["derivation"]["sources"]]
