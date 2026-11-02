"""How a person is named: the one place a display name and its initials are computed.

Every response that names a person goes through `display_name`, so the
fallback for someone with no stored name cannot differ between pages. The
fallback is computed on reading and never stored, so a guess from the email
is never mistaken for a name someone set.
"""

import re

#: The characters that split the part of an email before the `@` into a name
#: and a surname. A hyphen is not one: "kowalska-nowak" is one surname.
_PART_SEPARATORS = re.compile(r"[._]")


def _capitalise(part: str) -> str:
    """Each hyphen-separated piece with a capital first letter."""
    return "-".join(piece[:1].upper() + piece[1:] for piece in part.split("-"))


def name_parts_from_email(email: str) -> tuple[str, str | None]:
    """The name and surname derived from an email: the first part, then the rest.

    "jan.kowalski@example.com" gives ("Jan", "Kowalski"), "admin@example.com"
    gives ("Admin", None), "anna.maria.nowak@…" gives ("Anna", "Maria Nowak").
    """
    local = email.partition("@")[0]
    parts = [_capitalise(part) for part in _PART_SEPARATORS.split(local) if part]
    if not parts:
        # Only separators before the `@`: nothing to derive, but a person is
        # never nameless, so the address itself stands in.
        return (local or email, None)
    return (parts[0], " ".join(parts[1:]) or None)


def _stored(value: str | None) -> str | None:
    """A stored value, with a blank one counting as none."""
    if value is None:
        return None
    return value.strip() or None


def display_name(email: str, name: str | None, surname: str | None) -> str:
    """The stored name and surname joined by a space, or whichever is stored.

    With neither stored the name is derived from the email.
    """
    stored = [part for part in (_stored(name), _stored(surname)) if part]
    if stored:
        return " ".join(stored)
    derived_name, derived_surname = name_parts_from_email(email)
    return derived_name if derived_surname is None else f"{derived_name} {derived_surname}"


def initials(name: str) -> str:
    """The first letters of a display name's first two words, upper-cased.

    "Jan Kowalski" gives JK, "Admin" gives A.
    """
    return "".join(word[0] for word in name.split()[:2]).upper()
