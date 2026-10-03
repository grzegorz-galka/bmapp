"""The settings this change adds: the mode, the audience and the admin list."""

import pytest

from app.core.config import Mode, Settings


@pytest.fixture
def no_identity_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings as a process with nothing configured would read them.

    The suite itself runs in development mode with an administrator, set in
    conftest before the application is imported, so a test about the defaults
    has to take that back out.
    """
    for variable in ("BMAPP_MODE", "BMAPP_ADMIN_EMAILS", "BMAPP_OIDC_ISSUER"):
        monkeypatch.delenv(variable, raising=False)


@pytest.mark.usefixtures("no_identity_environment")
def test_the_default_mode_is_broker() -> None:
    """Forgetting to set the mode must not turn the local login on."""
    assert Settings().mode is Mode.BROKER


@pytest.mark.usefixtures("no_identity_environment")
def test_no_administrators_are_configured_by_default() -> None:
    assert Settings().admin_emails == frozenset()


def test_administrators_are_split_on_commas() -> None:
    settings = Settings(admin_emails="admin@pse.pl,jane.doe@pse.pl")
    assert settings.admin_emails == {"admin@pse.pl", "jane.doe@pse.pl"}


def test_administrator_emails_are_trimmed_and_lower_cased() -> None:
    """A different spelling in configuration still matches the broker's claim."""
    settings = Settings(admin_emails="  Admin@PSE.pl ,\tJane.Doe@pse.PL  ")
    assert settings.admin_emails == {"admin@pse.pl", "jane.doe@pse.pl"}


@pytest.mark.parametrize("configured", ["", "   ", ",", "admin@pse.pl,,", " , "])
def test_blank_entries_are_dropped(configured: str) -> None:
    """A trailing or stray comma must not stop the server."""
    assert "" not in Settings(admin_emails=configured).admin_emails


def test_the_audience_defaults_to_the_client_id() -> None:
    settings = Settings(oidc_client_id="bmapp")
    assert settings.audience == "bmapp"


def test_an_explicit_audience_overrides_the_client_id() -> None:
    """Brokers differ on what they put in `aud`, so it can be set apart."""
    settings = Settings(oidc_client_id="bmapp", oidc_audience="https://api.bmapp")
    assert settings.audience == "https://api.bmapp"
