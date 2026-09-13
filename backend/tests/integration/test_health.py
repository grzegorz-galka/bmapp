"""The health endpoint reports liveness and database reachability."""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


def test_reports_healthy_when_the_database_answers(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "reachable"}
