"""The schedule and meeting request schemas, and the codes they report. No I/O."""

import datetime
import uuid

import pytest
from pydantic import ValidationError

from app.main import _validation_code
from app.schemas import MeetingChange, MeetingOpen, MeetingRead, ScheduleSet


def _published_code(model: type, **fields: object) -> tuple[tuple[object, ...], str]:
    """The field and code the API would report for these fields."""
    with pytest.raises(ValidationError) as caught:
        model(**fields)
    error = caught.value.errors()[0]
    return error["loc"], _validation_code(str(error["type"]))


@pytest.mark.parametrize("weekday", [1, 7])
def test_accepts_the_first_and_last_weekday(weekday: int) -> None:
    assert ScheduleSet(weekday=weekday, time="13:00").weekday == weekday  # type: ignore[arg-type]


@pytest.mark.parametrize("weekday", [0, 8])
def test_rejects_a_weekday_out_of_range(weekday: int) -> None:
    assert _published_code(ScheduleSet, weekday=weekday, time="13:00") == (
        ("weekday",),
        "schedule_weekday.out_of_range",
    )


def test_a_missing_weekday_is_a_malformed_request() -> None:
    assert _published_code(ScheduleSet, time="13:00") == (("weekday",), "request.invalid_field")


@pytest.mark.parametrize("value", ["25:00", "13:60", "noon", "13:00:30", "13:00+02:00"])
def test_rejects_a_time_that_is_not_hh_mm(value: str) -> None:
    assert _published_code(MeetingOpen, date="2026-10-14", time=value) == (
        ("time",),
        "request.invalid_field",
    )


def test_rejects_a_date_that_is_not_a_date() -> None:
    assert _published_code(MeetingOpen, date="2026-02-30", time="13:00") == (
        ("date",),
        "request.invalid_field",
    )


def test_a_missing_date_is_a_malformed_request() -> None:
    assert _published_code(MeetingOpen, time="13:00") == (("date",), "request.invalid_field")


def test_a_time_is_written_back_as_hh_mm() -> None:
    meeting = MeetingRead(
        id=uuid.uuid4(),
        team_id=uuid.uuid4(),
        date=datetime.date(2026, 10, 14),
        time=datetime.time(13, 0),
        starts_at=datetime.datetime(2026, 10, 14, 11, 0, tzinfo=datetime.UTC),
        host=None,
    )

    dumped = meeting.model_dump(mode="json")

    assert dumped["time"] == "13:00"
    assert dumped["starts_at"] == "2026-10-14T11:00:00Z"


def test_an_absent_host_is_told_apart_from_a_null_one() -> None:
    absent = MeetingChange.model_validate({"time": "14:00"})
    cleared = MeetingChange.model_validate({"host_employee_id": None})

    assert "host_employee_id" not in absent.model_fields_set
    assert "host_employee_id" in cleared.model_fields_set
    assert cleared.host_employee_id is None


@pytest.mark.parametrize("field", ["date", "time"])
def test_a_meeting_cannot_have_its_date_or_time_cleared(field: str) -> None:
    assert _published_code(MeetingChange, **{field: None}) == ((field,), "request.invalid_field")
