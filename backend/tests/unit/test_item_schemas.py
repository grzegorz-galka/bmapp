"""The problem and task request schemas and the codes they report. No I/O."""

import datetime
import uuid

import pytest
from pydantic import BaseModel, ValidationError

from app.core.item_enums import Stage
from app.main import _validation_code
from app.schemas import ProblemChange, ProblemCreate, TaskChange, TaskCreate

EVERY_SCHEMA: list[type[BaseModel]] = [ProblemCreate, ProblemChange, TaskCreate, TaskChange]
Create = type[ProblemCreate] | type[TaskCreate]
Change = type[ProblemChange] | type[TaskChange]
CREATES: list[Create] = [ProblemCreate, TaskCreate]
TEXT_FIELDS = [(ProblemCreate, "reason"), (ProblemCreate, "solution"), (TaskCreate, "details")]
TEXT_FIELDS += [(ProblemChange, "reason"), (ProblemChange, "solution"), (TaskChange, "details")]


def _published_code(schema: type[BaseModel], **fields: object) -> tuple[tuple[object, ...], str]:
    """The field and code the API would report for these fields."""
    with pytest.raises(ValidationError) as caught:
        schema.model_validate(fields)
    errors = caught.value.errors()
    assert len(errors) == 1
    return errors[0]["loc"], _validation_code(str(errors[0]["type"]))


@pytest.mark.parametrize("schema", CREATES)
def test_a_missing_summary(schema: type[BaseModel]) -> None:
    assert _published_code(schema, due_on="2026-10-20") == (("summary",), "item_summary.blank")


@pytest.mark.parametrize("schema", EVERY_SCHEMA)
@pytest.mark.parametrize("blank", ["", "   ", "\n\t ", None])
def test_a_blank_summary(schema: type[BaseModel], blank: str | None) -> None:
    assert _published_code(schema, summary=blank) == (("summary",), "item_summary.blank")


@pytest.mark.parametrize("schema", EVERY_SCHEMA)
def test_a_summary_of_501_characters(schema: type[BaseModel]) -> None:
    assert _published_code(schema, summary="x" * 501) == (("summary",), "item_summary.too_long")


@pytest.mark.parametrize("schema", CREATES)
def test_a_summary_of_500_characters_after_trimming_is_accepted(schema: Create) -> None:
    item = schema.model_validate({"summary": "  " + "x" * 500 + "  "})

    assert item.summary == "x" * 500


@pytest.mark.parametrize(("schema", "field"), TEXT_FIELDS)
def test_a_text_of_4001_characters(schema: type[BaseModel], field: str) -> None:
    fields = {"summary": "Builds are flaky", field: "x" * 4001}

    assert _published_code(schema, **fields) == ((field,), "item_text.too_long")


@pytest.mark.parametrize(("schema", "field"), TEXT_FIELDS)
def test_a_text_of_4000_characters_after_trimming_is_accepted(
    schema: type[BaseModel], field: str
) -> None:
    item = schema.model_validate({"summary": "Flaky", field: " " + "x" * 4000 + "\n"})

    assert len(getattr(item, field)) == 4000


@pytest.mark.parametrize(("schema", "field"), TEXT_FIELDS)
@pytest.mark.parametrize("blank", ["   ", None])
def test_a_blank_text_is_stored_as_empty(
    schema: type[BaseModel], field: str, blank: str | None
) -> None:
    assert getattr(schema.model_validate({"summary": "Flaky", field: blank}), field) == ""


@pytest.mark.parametrize("schema", EVERY_SCHEMA)
@pytest.mark.parametrize("stage", ["done", "", "ACT", None])
def test_an_unknown_stage(schema: type[BaseModel], stage: str | None) -> None:
    fields = {"summary": "Flaky", "stage": stage}

    assert _published_code(schema, **fields) == (("stage",), "request.invalid_field")


@pytest.mark.parametrize("schema", EVERY_SCHEMA)
@pytest.mark.parametrize("due_on", ["14.10.2026", "2026-13-01", "tomorrow"])
def test_a_malformed_date(schema: type[BaseModel], due_on: str) -> None:
    fields = {"summary": "Flaky", "due_on": due_on}

    assert _published_code(schema, **fields) == (("due_on",), "request.invalid_field")


@pytest.mark.parametrize("schema", CREATES)
def test_a_new_item_starts_not_started_with_empty_texts(schema: Create) -> None:
    item = schema.model_validate({"summary": "  Builds are flaky "})

    assert item.summary == "Builds are flaky"
    assert item.stage is Stage.NOT_STARTED
    assert item.due_on is None
    assert item.responsible_employee_id is None


@pytest.mark.parametrize("schema", [ProblemChange, TaskChange])
def test_a_change_with_only_due_on(schema: Change) -> None:
    change = schema.model_validate({"due_on": "2026-10-20"})

    assert change.model_fields_set == {"due_on"}
    assert change.due_on == datetime.date(2026, 10, 20)


@pytest.mark.parametrize("schema", [ProblemChange, TaskChange])
def test_null_clears_an_optional_field(schema: Change) -> None:
    change = schema.model_validate({"responsible_employee_id": None, "due_on": None})

    assert change.model_fields_set == {"responsible_employee_id", "due_on"}
    assert change.responsible_employee_id is None


def test_a_task_change_detaches_its_problem_with_null() -> None:
    change = TaskChange.model_validate({"problem_id": None})

    assert change.model_fields_set == {"problem_id"}
    assert change.problem_id is None


def test_a_task_names_its_problem() -> None:
    problem_id = uuid.uuid4()

    assert TaskCreate(summary="Fix it", problem_id=problem_id).problem_id == problem_id
