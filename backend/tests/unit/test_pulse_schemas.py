"""The pulse answer request schema, the codes it reports, and how results are written. No I/O."""

import datetime
import uuid
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.core.metric_enums import Status
from app.main import _validation_code
from app.schemas import PulseAnswerWrite, PulsePrevious, PulseResults, PulseTrendPoint


def _published_code(**fields: object) -> tuple[tuple[object, ...], str]:
    """The field and code the API would report for these fields."""
    with pytest.raises(ValidationError) as caught:
        PulseAnswerWrite(**fields)
    errors = caught.value.errors()
    assert len(errors) == 1
    return errors[0]["loc"], _validation_code(str(errors[0]["type"]))


def test_an_answer_with_only_a_rating_has_empty_texts() -> None:
    answer = PulseAnswerWrite(rating=4)

    assert (answer.rating, answer.positive, answer.negative, answer.better) == (4, "", "", "")


@pytest.mark.parametrize("rating", [1, 5])
def test_the_ends_of_the_scale_are_accepted(rating: int) -> None:
    assert PulseAnswerWrite(rating=rating).rating == rating


def test_a_missing_rating() -> None:
    assert _published_code(positive="ok") == (("rating",), "pulse_rating.out_of_range")


@pytest.mark.parametrize("rating", [0, 6, 3.5, "4", None, True])
def test_a_rating_out_of_range(rating: object) -> None:
    assert _published_code(rating=rating) == (("rating",), "pulse_rating.out_of_range")


def test_a_rating_from_json_is_strict() -> None:
    with pytest.raises(ValidationError) as caught:
        PulseAnswerWrite.model_validate_json('{"rating": "4"}')

    assert _validation_code(str(caught.value.errors()[0]["type"])) == "pulse_rating.out_of_range"
    assert PulseAnswerWrite.model_validate_json('{"rating": 4}').rating == 4


@pytest.mark.parametrize("field", ["positive", "negative", "better"])
def test_a_text_that_is_too_long(field: str) -> None:
    assert _published_code(rating=3, **{field: "x" * 2001}) == ((field,), "pulse_text.too_long")


@pytest.mark.parametrize("field", ["positive", "negative", "better"])
def test_a_text_of_2000_characters_after_trimming_is_accepted(field: str) -> None:
    answer = PulseAnswerWrite(rating=3, **{field: "  " + "x" * 2000 + "  "})

    assert len(getattr(answer, field)) == 2000


@pytest.mark.parametrize("blank", ["   ", "\n\t ", None])
def test_blank_texts_are_stored_as_empty(blank: str | None) -> None:
    answer = PulseAnswerWrite(rating=3, positive=blank, negative=blank, better=blank)

    assert (answer.positive, answer.negative, answer.better) == ("", "", "")


def test_texts_are_trimmed() -> None:
    assert PulseAnswerWrite(rating=4, positive="  Release went out \n").positive == (
        "Release went out"
    )


def test_results_write_averages_with_two_decimal_places() -> None:
    meeting_id = uuid.uuid4()
    earlier_id = uuid.uuid4()
    results = PulseResults(
        meeting_id=meeting_id,
        editable=True,
        answered=7,
        members=11,
        average=Decimal(25) / 7,
        status=Status.AMBER,
        previous=PulsePrevious(
            meeting_id=earlier_id, date=datetime.date(2026, 9, 30), average=Decimal("3.8")
        ),
        change=Decimal(25) / 7 - Decimal("3.8"),
        distribution={1: 0, 2: 1, 3: 2, 4: 3, 5: 1},
        trend=[
            PulseTrendPoint(
                meeting_id=earlier_id,
                date=datetime.date(2026, 9, 30),
                average=Decimal(4),
                status=Status.GREEN,
                answered=5,
            )
        ],
        answers=None,
        missing=None,
        missing_count=4,
        own=None,
    )

    written = results.model_dump(mode="json")

    assert written["average"] == "3.57"
    assert written["change"] == "-0.23"
    assert written["previous"]["average"] == "3.80"
    assert written["trend"][0]["average"] == "4.00"
    assert written["distribution"] == {"1": 0, "2": 1, "3": 2, "4": 3, "5": 1}
    assert (written["answers"], written["missing"], written["own"]) == (None, None, None)


def test_a_change_that_rounds_to_zero_is_written_without_a_sign() -> None:
    point = PulsePrevious(
        meeting_id=uuid.uuid4(), date=datetime.date(2026, 9, 30), average=Decimal("-0.001")
    )

    assert point.model_dump(mode="json")["average"] == "0.00"
