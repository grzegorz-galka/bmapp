"""Unit tests for the team request schema. No I/O."""

import pytest
from pydantic import ValidationError

from app.models import TEAM_NAME_MAX_LENGTH
from app.schemas import TeamCreate


def test_accepts_a_plain_name() -> None:
    assert TeamCreate(name="Platform").name == "Platform"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_rejects_blank_and_whitespace_only_names(name: str) -> None:
    with pytest.raises(ValidationError) as caught:
        TeamCreate(name=name)
    assert caught.value.errors()[0]["loc"] == ("name",)


def test_rejects_a_name_longer_than_the_limit_once_trimmed() -> None:
    with pytest.raises(ValidationError) as caught:
        TeamCreate(name="x" * (TEAM_NAME_MAX_LENGTH + 1))
    assert caught.value.errors()[0]["loc"] == ("name",)


def test_accepts_a_name_at_exactly_the_limit() -> None:
    name = "x" * TEAM_NAME_MAX_LENGTH
    assert TeamCreate(name=name).name == name


def test_trims_surrounding_whitespace() -> None:
    assert TeamCreate(name="  Platform  ").name == "Platform"


def test_padding_does_not_smuggle_an_over_length_name_past_the_limit() -> None:
    padded = "  " + "x" * TEAM_NAME_MAX_LENGTH + "  "
    assert TeamCreate(name=padded).name == "x" * TEAM_NAME_MAX_LENGTH

    with pytest.raises(ValidationError):
        TeamCreate(name="  " + "x" * (TEAM_NAME_MAX_LENGTH + 1) + "  ")
