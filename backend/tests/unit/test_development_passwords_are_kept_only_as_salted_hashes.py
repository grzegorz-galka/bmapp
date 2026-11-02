"""Requirement: Development passwords are kept only as salted hashes.

That no log entry contains the password is asserted where the password is set,
in `test_a_sign_in_is_logged_without_the_password`; here the stored form.
"""

import pytest

from app.services.dev_login import hash_password, verify_password


def test_the_stored_record_does_not_reveal_the_password() -> None:
    first = hash_password("zielony-las")
    second = hash_password("zielony-las")

    assert "zielony-las" not in first
    assert first != second, "two people choosing the same password get different values"
    assert verify_password("zielony-las", first)
    assert verify_password("zielony-las", second)


def test_the_stored_form_names_its_scheme_and_cost() -> None:
    """So the cost can be raised later and old hashes still verify."""
    scheme, n, r, p, salt, key = hash_password("zielony-las").split("$")
    assert (scheme, n, r, p) == ("scrypt", "16384", "8", "1")
    assert salt and key


@pytest.mark.parametrize("password", ["", "zielony-la", "Zielony-las", "zielony-las "])
def test_another_password_does_not_verify(password: str) -> None:
    assert not verify_password(password, hash_password("zielony-las"))


@pytest.mark.parametrize(
    "stored",
    ["", "zielony-las", "bcrypt$16384$8$1$c2FsdA==$a2V5", "scrypt$x$8$1$c2FsdA==$a2V5", "scrypt$1"],
)
def test_a_malformed_record_never_verifies(stored: str) -> None:
    assert not verify_password("zielony-las", stored)
