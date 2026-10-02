"""The team endpoints' shape: path validation, the OpenAPI document and the business log."""

import logging
import uuid

import pytest
from fastapi.testclient import TestClient

from tests.integration.teams_api import add, member_id, register

pytestmark = pytest.mark.integration

SERVICE_LOGGER = "app.services.teams"


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/teams/not-a-uuid", None),
        ("POST", "/teams/not-a-uuid/members", {"email": "jan@example.com"}),
        ("DELETE", f"/teams/not-a-uuid/members/{uuid.uuid4()}", None),
        ("DELETE", f"/teams/{uuid.uuid4()}/members/not-a-uuid", None),
        ("PUT", "/teams/not-a-uuid/leader", {"employee_id": str(uuid.uuid4())}),
    ],
)
def test_a_non_uuid_path_id_is_rejected(
    client: TestClient, method: str, path: str, body: object
) -> None:
    response = client.request(method, path, json=body)

    assert response.status_code == 422
    assert {e["code"] for e in response.json()["errors"]} == {"request.invalid_field"}


def test_a_non_uuid_new_leader_is_rejected(client: TestClient) -> None:
    team = register(client)

    response = client.put(f"/teams/{team['id']}/leader", json={"employee_id": "nope"})

    assert response.status_code == 422
    error = response.json()["errors"][0]
    assert (error["field"], error["code"]) == ("employee_id", "request.invalid_field")


def test_the_openapi_document_lists_the_new_shapes(client: TestClient) -> None:
    document = client.get("/openapi.json").json()

    schemas = document["components"]["schemas"]
    assert {"TeamRead", "TeamDetail", "MemberRead", "LeaderRead", "MemberAdd", "LeaderChange"} <= (
        schemas.keys()
    )
    assert {"leader", "member_count"} <= schemas["TeamRead"]["properties"].keys()
    assert set(schemas["TeamCreate"]["required"]) == {"name", "leader_email"}
    paths = document["paths"]
    assert "get" in paths["/teams/{team_id}"]
    assert "post" in paths["/teams/{team_id}/members"]
    assert "delete" in paths["/teams/{team_id}/members/{employee_id}"]
    assert "put" in paths["/teams/{team_id}/leader"]


def _business_events(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [
        record.getMessage()
        for record in caplog.records
        if record.name == SERVICE_LOGGER and record.levelno == logging.INFO
    ]


def test_registration_is_logged(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger=SERVICE_LOGGER):
        team = register(client, "Platform", "maria@example.com")

    assert _business_events(caplog) == [
        f"Team {team['id']} registered with leader maria@example.com"
    ]


def test_adding_a_member_is_logged(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    team = register(client)
    with caplog.at_level(logging.INFO, logger=SERVICE_LOGGER):
        add(client, team["id"], "jan@example.com")

    assert _business_events(caplog) == [f"Member jan@example.com added to team {team['id']}"]


def test_removing_a_member_is_logged(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    team = register(client)
    jan = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")
    with caplog.at_level(logging.INFO, logger=SERVICE_LOGGER):
        client.delete(f"/teams/{team['id']}/members/{jan}")

    assert _business_events(caplog) == [f"Member jan@example.com removed from team {team['id']}"]


def test_a_handover_is_logged(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    team = register(client)
    jan = member_id(add(client, team["id"], "jan@example.com"), "jan@example.com")
    with caplog.at_level(logging.INFO, logger=SERVICE_LOGGER):
        client.put(f"/teams/{team['id']}/leader", json={"employee_id": jan})

    assert _business_events(caplog) == [
        f"Leadership of team {team['id']} handed over to jan@example.com"
    ]
