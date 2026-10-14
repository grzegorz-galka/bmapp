"""Requirement: The development password is derived from the email."""

import pytest

from app.services.dev_login import dev_password


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("grzegorz.galka@pse.pl", "grgapspl"),
        ("admin@company.com", "adcoco"),
    ],
)
def test_dots_and_the_at_sign_split_the_email(email: str, password: str) -> None:
    assert dev_password(email) == password


def test_the_administrators_password() -> None:
    assert dev_password("admin@example.com") == "adexco"


def test_any_character_that_is_not_a_letter_or_digit_splits_the_email() -> None:
    assert dev_password("jan_k-x@a.pl") == "jakxapl"


def test_a_run_of_separators_counts_once() -> None:
    assert dev_password("a..b@c.pl") == "abcpl"


def test_a_one_character_run_gives_its_one_character() -> None:
    assert dev_password("a.b@c.pl") == "abcpl"


def test_a_trailing_separator_adds_nothing() -> None:
    assert dev_password("a@b.") == "ab"


def test_digits_count_as_characters_not_separators() -> None:
    assert dev_password("jan2@a1.pl") == "jaa1pl"


def test_the_one_letter_password_of_the_earlier_rule_is_not_the_password() -> None:
    assert dev_password("grzegorz.galka@pse.pl") != "ggpp"
