"""One test per scenario of "A person is named by a display name" (team-membership spec)."""

from app.services.names import display_name, initials, name_parts_from_email


def test_two_parts_give_a_name_and_a_surname() -> None:
    """Scenario: Two parts give a name and a surname."""
    email = "jan.kowalski@example.com"

    assert display_name(email, None, None) == "Jan Kowalski"
    assert name_parts_from_email(email) == ("Jan", "Kowalski")
    assert initials(display_name(email, None, None)) == "JK"


def test_one_part_gives_a_name_only() -> None:
    """Scenario: One part gives a name only."""
    email = "admin@example.com"

    assert display_name(email, None, None) == "Admin"
    assert name_parts_from_email(email) == ("Admin", None)
    assert initials("Admin") == "A"


def test_more_parts_make_up_the_surname() -> None:
    """Scenario: More parts make up the surname."""
    email = "anna.maria.nowak@example.com"

    assert display_name(email, None, None) == "Anna Maria Nowak"
    assert name_parts_from_email(email) == ("Anna", "Maria Nowak")
    assert initials("Anna Maria Nowak") == "AM"


def test_an_underscore_splits_and_a_hyphen_does_not() -> None:
    """Scenario: An underscore splits and a hyphen does not."""
    email = "ewa_kowalska-nowak@example.com"

    assert display_name(email, None, None) == "Ewa Kowalska-Nowak"
    assert name_parts_from_email(email) == ("Ewa", "Kowalska-Nowak")
    # Empty parts from repeated separators are dropped.
    assert name_parts_from_email("ewa.._kowalska@example.com") == ("Ewa", "Kowalska")


def test_stored_values_win_over_the_email() -> None:
    """Scenario: Stored values win over the email."""
    name = display_name("grzegorz.galka@pse.pl", "Grzegorz", "Gałka")

    assert name == "Grzegorz Gałka"
    assert initials(name) == "GG"


def test_only_a_surname_is_stored() -> None:
    """Scenario: Only a surname is stored."""
    assert display_name("jan.kowalski@example.com", None, "Kowalski") == "Kowalski"
    # A blank stored value counts as none.
    assert display_name("jan.kowalski@example.com", "  ", "Kowalski") == "Kowalski"


def test_an_address_of_only_separators_is_named_by_itself() -> None:
    """A local part of nothing but separators still names the person: by itself."""
    assert name_parts_from_email("._@example.com") == ("._", None)
    assert display_name("._@example.com", None, None) == "._"
