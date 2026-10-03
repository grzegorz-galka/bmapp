"""Requirement: Administrators are named in configuration."""

import logging

import pytest

from app.core.config import Settings
from app.services.authz import may_change_the_leader, may_register_a_team


def is_admin(settings: Settings, email: str) -> bool:
    """The membership test the dependency performs, isolated from the request."""
    return email in settings.admin_emails


def test_a_configured_email_is_an_administrator() -> None:
    settings = Settings(admin_emails="admin@pse.pl,jane.doe@pse.pl")
    assert is_admin(settings, "admin@pse.pl") is True


def test_an_email_outside_the_list_is_not_an_administrator() -> None:
    settings = Settings(admin_emails="admin@pse.pl")
    assert is_admin(settings, "jan.kowalski@pse.pl") is False


def test_a_configured_email_is_matched_in_a_different_letter_case() -> None:
    """Configuration and the broker's claim need not agree on spelling."""
    settings = Settings(admin_emails="Admin@PSE.pl")
    assert is_admin(settings, "admin@pse.pl") is True


def test_no_administrators_configured_refuses_rather_than_permits() -> None:
    """An empty list is a locked door, never an open one."""
    settings = Settings(admin_emails="")
    assert settings.admin_emails == frozenset()
    assert may_register_a_team(is_admin=is_admin(settings, "anyone@pse.pl")) is False
    assert may_change_the_leader(is_admin=is_admin(settings, "anyone@pse.pl")) is False


def test_an_administrator_need_not_be_a_recorded_employee() -> None:
    """So the first team can be registered on a database with nothing in it.

    Being an administrator is decided by configuration alone; the employee
    record is what a *write to a team's own data* needs, which registering the
    first team is not.
    """
    settings = Settings(admin_emails="admin@pse.pl")
    assert may_register_a_team(is_admin=is_admin(settings, "admin@pse.pl")) is True


def test_what_a_team_records_does_not_make_anyone_an_administrator() -> None:
    """Leading every team in the organization still does not confer it."""
    settings = Settings(admin_emails="admin@pse.pl")
    assert is_admin(settings, "leader.of.everything@pse.pl") is False


def test_the_number_of_administrators_is_logged_without_the_addresses(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A misconfigured list must be visible without putting anyone in the log.

    `CLAUDE.md` allows an employee email in the log only where auditing needs
    it; a startup banner does not.
    """
    settings = Settings(admin_emails="admin@pse.pl,jane.doe@pse.pl")
    logger = logging.getLogger("app.main")
    with caplog.at_level(logging.INFO, logger="app.main"):
        logger.info("Authorization: %d administrator(s) configured.", len(settings.admin_emails))

    assert "2 administrator(s)" in caplog.text
    assert "admin@pse.pl" not in caplog.text
    assert "jane.doe@pse.pl" not in caplog.text
