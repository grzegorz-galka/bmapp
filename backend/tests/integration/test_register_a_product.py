"""One test per scenario of "Register a product" in specs/projects-and-products/spec.md."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Product
from tests.integration.meetings_api import error_of
from tests.integration.projects_api import PRODUCT, add_product, post_product
from tests.integration.teams_api import LEADER_EMAIL, register

pytestmark = pytest.mark.integration

ClientAs = Callable[[str], TestClient]


def test_a_product_is_added(client: TestClient, client_as: ClientAs) -> None:
    """Scenario: A product is added."""
    team = register(client)

    product = add_product(
        client_as(LEADER_EMAIL),
        team["id"],
        name="Customer portal",
        owner_email="jan@example.com",
        jira_url="https://jira.example.com/secure/RapidBoard.jspa?rapidView=17",
    )

    assert product["id"]
    assert product["team_id"] == team["id"]
    assert product["name"] == "Customer portal"
    assert product["owner"]["email"] == "jan@example.com"
    assert product["owner"]["display_name"] == "Jan"
    assert product["jira_url"] == PRODUCT["jira_url"]
    assert product["active"] is True


def test_a_product_without_a_jira_board(client: TestClient) -> None:
    """Scenario: A product without a Jira board."""
    team = register(client)

    product = add_product(client, team["id"], jira_url=None)

    assert product["jira_url"] is None


def test_the_name_is_taken_in_the_team(client: TestClient, session: Session) -> None:
    """Scenario: The name is taken in the team."""
    team = register(client)
    add_product(client, team["id"], name="Customer portal")

    response = post_product(client, team["id"], name="customer portal")

    assert response.status_code == 409
    assert error_of(response) == ("name", "product_name.duplicate")
    assert session.query(Product).count() == 1


def test_two_teams_have_a_product_of_the_same_name(client: TestClient) -> None:
    """Scenario: Two teams have a product of the same name."""
    platform = register(client, "Platform")
    quality = register(client, "Quality", "quality-lead@example.com")

    first = add_product(client, platform["id"], name="Customer portal")
    second = add_product(client, quality["id"], name="Customer portal")

    assert first["id"] != second["id"]


@pytest.mark.parametrize(
    ("name", "code"), [("   ", "product_name.blank"), ("x" * 201, "product_name.too_long")]
)
def test_name_is_blank_or_too_long(
    client: TestClient, session: Session, name: str, code: str
) -> None:
    """Scenario: Name is blank or too long."""
    team = register(client)

    response = post_product(client, team["id"], name=name)

    assert response.status_code == 422
    assert error_of(response) == ("name", code)
    assert session.query(Product).count() == 0


@pytest.mark.parametrize(
    ("url", "code"),
    [
        ("jira/board/17", "product_jira_url.invalid"),
        ("ftp://jira.example.com", "product_jira_url.invalid"),
        ("https://jira.example.com/" + "x" * 2000, "product_jira_url.too_long"),
    ],
)
def test_the_link_is_not_a_web_address(
    client: TestClient, session: Session, url: str, code: str
) -> None:
    """Scenario: The link is not a web address."""
    team = register(client)

    response = post_product(client, team["id"], jira_url=url)

    assert response.status_code == 422
    assert error_of(response) == ("jira_url", code)
    assert session.query(Product).count() == 0
