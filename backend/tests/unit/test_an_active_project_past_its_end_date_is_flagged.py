"""One test per scenario of "An active project past its end date is flagged".

In specs/projects-and-products/spec.md, against the pure `past_end`; the
interface's mark is verified by the projects and products page's tests.
"""

import datetime

from app.services.projects import past_end

READ_ON = datetime.date(2026, 11, 6)


def test_an_active_project_past_its_end() -> None:
    """Scenario: An active project past its end."""
    assert past_end(True, datetime.date(2026, 10, 31), READ_ON) is True


def test_a_project_ending_today() -> None:
    """Scenario: A project ending today."""
    assert past_end(True, datetime.date(2026, 11, 6), READ_ON) is False


def test_an_inactive_project_is_never_flagged() -> None:
    """Scenario: An inactive project is never flagged."""
    assert past_end(False, datetime.date(2026, 10, 31), READ_ON) is False
