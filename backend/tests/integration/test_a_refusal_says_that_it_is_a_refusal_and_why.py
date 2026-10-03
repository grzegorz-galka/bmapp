"""Requirement: A refusal says that it is a refusal, and why."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.integration.teams_api import register

LEADER = "lead@pse.pl"
OUTSIDER = "stranger@pse.pl"


def test_a_forbidden_write_is_refused_with_its_code(
    client_as: Callable[[str], TestClient],
) -> None:
    response = client_as(OUTSIDER).post("/teams", json={"name": "Platform", "leader_email": LEADER})

    assert response.status_code == 403
    assert response.json() == {
        "errors": [
            {
                "field": None,
                "code": "auth.forbidden",
                "message": "You are not permitted to perform this action.",
            }
        ]
    }


def test_a_refusal_uses_the_same_body_shape_as_every_other_rejection(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """The frontend parses one shape, not two."""
    team = register(client, "Platform", LEADER)

    forbidden = client_as(OUTSIDER).post(f"/teams/{team['id']}/members", json={"email": "x@pse.pl"})
    validation = client.post(f"/teams/{team['id']}/members", json={"email": ""})

    for response in (forbidden, validation):
        entry = response.json()["errors"][0]
        assert set(entry) == {"field", "code", "message"}
        assert isinstance(entry["code"], str) and "." in entry["code"]


def test_a_refusal_reports_403_rather_than_concealing_the_team(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """Every authenticated person may read every team, so there is nothing to hide."""
    team = register(client, "Platform", LEADER)

    refused = client_as(OUTSIDER).post(f"/teams/{team['id']}/members", json={"email": "x@pse.pl"})
    readable = client_as(OUTSIDER).get(f"/teams/{team['id']}")

    assert refused.status_code == 403
    assert readable.status_code == 200


def test_a_write_by_someone_who_is_not_an_employee_names_that_reason(
    client: TestClient, client_as: Callable[[str], TestClient]
) -> None:
    """`auth.not_an_employee` is distinct from a plain refusal.

    Reached through the leader guard: an administrator who is not a recorded
    employee may still act, so the code appears where a write genuinely needs
    the employee record rather than merely a permission.
    """
    from app.core.exceptions import NotAnEmployeeError

    error = NotAnEmployeeError("nobody@pse.pl")
    assert (error.status_code, error.code) == (403, "auth.not_an_employee")
    assert "nobody@pse.pl" in error.message


def test_an_unauthenticated_write_is_401_not_403(anonymous_client: TestClient) -> None:
    """Who you are has not been established, so the answer is "authenticate"."""
    response = anonymous_client.post("/teams", json={"name": "Platform", "leader_email": LEADER})

    assert response.status_code == 401
    assert response.json()["errors"][0]["code"] == "auth.token_missing"
