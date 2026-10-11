"""Requirement: The development password is derived from the email."""

import pytest

from app.services.dev_login import dev_password


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("grzegorz.galka@pse.pl", "ggpp"),
        ("admin@company.com", "acc"),
        ("admin@example.com", "aec"),
    ],
)
def test_dots_and_the_at_sign_split_the_email(email: str, password: str) -> None:
    assert dev_password(email) == password


def test_any_character_that_is_not_a_letter_or_digit_splits_the_email() -> None:
    assert dev_password("jan_k-x@a.pl") == "jkxap"


def test_a_run_of_separators_counts_once() -> None:
    assert dev_password("a..b@c.pl") == "abcp"


def test_a_trailing_separator_adds_nothing() -> None:
    assert dev_password("a@b.") == "ab"


def test_digits_count_as_characters_not_separators() -> None:
    assert dev_password("jan2@a1.pl") == "jap"
