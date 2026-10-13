"""The API half of "The dashboard shows the company declarations" in specs/dashboard/spec.md.

How the declarations are laid out and redisplayed on a language change is
the frontend's; this is which declarations the summary carries.
"""

from fastapi.testclient import TestClient

from tests.integration.dashboard_api import dashboard_of


def test_the_declarations_are_the_companys(client: TestClient) -> None:
    """Scenario: The declarations are the company's."""
    declarations = dashboard_of(client)["declarations"]

    assert declarations["mission"]["pl"] == "Jesteśmy po to, aby zmieniać energetykę na lepsze"
    assert declarations["vision"]["pl"] == "Chcemy tworzyć najlepsze rozwiązania w branży"
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
    strategy = declarations["strategy"]
    assert strategy["horizon"]["pl"] == "Do 2030 roku"
    assert [statement["pl"] for statement in strategy["statements"]] == [
        "PSE Innowacje stanie się firmą tworzącą najlepsze rozwiązania dla branży "
        "energetycznej w Polsce, osiągającą najwyższy poziom satysfakcji klientów.",
        "Osiągniemy to poprzez bycie najbardziej skutecznymi w dowożeniu.",
    ]
    assert [
        (group["horizon"]["pl"], [item["pl"] for item in group["items"]])
        for group in declarations["goals"]
    ] == [
        (
            "W 2026 roku",
            [
                "Wzrost: 174 mln zł przychodu przy zatrudnieniu 397 osób",
                "Satysfakcja klienta: pierwszy pomiar NPS z wynikiem dodatnim",
            ],
        ),
        (
            "Do 2030 roku",
            ["Satysfakcja pracowników: eNPS 35+", "Satysfakcja klienta: NPS 50+"],
        ),
    ]


def test_the_declarations_are_translated(client: TestClient) -> None:
    """Scenario: The declarations are translated (the API half)."""
    declarations = dashboard_of(client)["declarations"]

    assert declarations["mission"]["en"] == (
        "We are here to change the energy sector for the better"
    )
    assert [value["name"]["en"] for value in declarations["values"]] == [
        "Effectiveness",
        "Passion",
        "Innovation",
        "Collaboration",
    ]
    assert declarations["strategy"]["horizon"]["en"] == "By 2030"
    assert [group["horizon"]["en"] for group in declarations["goals"]] == ["In 2026", "By 2030"]
