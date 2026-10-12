"""The API half of "The dashboard shows the company declarations" in specs/dashboard/spec.md.

How the declarations are laid out and redisplayed on a language change is
the frontend's; this is which declarations the summary carries.
"""

from fastapi.testclient import TestClient

from tests.integration.dashboard_api import dashboard_of


def test_the_declarations_are_the_companys(client: TestClient) -> None:
    """Scenario: The declarations are the company's."""
    declarations = dashboard_of(client)["declarations"]

    assert declarations["mission"]["headline"]["pl"] == (
        "Jesteśmy po to, aby zmieniać energetykę na lepsze"
    )
    assert declarations["vision"]["headline"]["pl"] == (
        "Chcemy tworzyć najlepsze rozwiązania w branży"
    )
    assert [value["name"]["pl"] for value in declarations["values"]] == [
        "Skuteczność",
        "Pasja",
        "Innowacyjność",
        "Współdziałanie",
    ]
    assert [value["icon"] for value in declarations["values"]] == [
        "effectiveness",
        "passion",
        "innovation",
        "collaboration",
    ]
    assert len(declarations["goals"]) == 3
