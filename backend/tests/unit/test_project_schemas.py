"""Unit tests for the project and product request schemas. No I/O."""

import datetime
from typing import Any

import pytest
from pydantic import BaseModel, ValidationError

from app.models import (
    PRODUCT_JIRA_URL_MAX_LENGTH,
    PRODUCT_NAME_MAX_LENGTH,
    PROJECT_CODE_MAX_LENGTH,
    PROJECT_NAME_MAX_LENGTH,
)
from app.schemas import ProductChange, ProductCreate, ProjectChange, ProjectCreate

PROJECT = {
    "code": "PRJ-042",
    "name": "Billing rewrite",
    "manager_email": "anna@example.com",
    "start_date": "2026-09-01",
    "end_date": "2027-03-31",
}
PRODUCT = {"name": "Customer portal", "owner_email": "jan@example.com"}
JIRA = "https://jira.example.com/secure/RapidBoard.jspa?rapidView=17"


def _refusal(model: type[BaseModel], body: dict[str, Any]) -> tuple[tuple[Any, ...], str]:
    """The location and code of the one error a body is refused with."""
    with pytest.raises(ValidationError) as caught:
        model.model_validate(body)
    [error] = caught.value.errors()
    return error["loc"], error["type"]


def test_a_project_is_trimmed() -> None:
    project = ProjectCreate.model_validate(
        {**PROJECT, "code": "  PRJ-042 ", "name": " Billing rewrite  "}
    )
    assert (project.code, project.name) == ("PRJ-042", "Billing rewrite")
    assert project.manager_email == "anna@example.com"


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("code", "", "project_code.blank"),
        ("code", "   ", "project_code.blank"),
        ("code", None, "project_code.blank"),
        ("code", "x" * (PROJECT_CODE_MAX_LENGTH + 1), "project_code.too_long"),
        ("name", "  ", "project_name.blank"),
        ("name", "x" * (PROJECT_NAME_MAX_LENGTH + 1), "project_name.too_long"),
    ],
)
def test_blank_and_long_codes_and_names(field: str, value: Any, code: str) -> None:
    assert _refusal(ProjectCreate, {**PROJECT, field: value}) == ((field,), code)


def test_an_absent_code_is_blank() -> None:
    body = {key: value for key, value in PROJECT.items() if key != "code"}
    assert _refusal(ProjectCreate, body) == (("code",), "project_code.blank")


def test_codes_and_names_at_the_limit_once_trimmed() -> None:
    code = "x" * PROJECT_CODE_MAX_LENGTH
    name = "y" * PROJECT_NAME_MAX_LENGTH
    project = ProjectCreate.model_validate({**PROJECT, "code": f" {code} ", "name": f" {name} "})
    assert (project.code, project.name) == (code, name)


def test_end_date_before_start() -> None:
    body = {**PROJECT, "start_date": "2026-09-01", "end_date": "2026-08-31"}
    assert _refusal(ProjectCreate, body) == (("end_date",), "project_dates.order")


def test_a_project_lasting_one_day() -> None:
    project = ProjectCreate.model_validate(
        {**PROJECT, "start_date": "2026-09-01", "end_date": "2026-09-01"}
    )
    assert project.end_date == datetime.date(2026, 9, 1)


def test_a_malformed_manager_email() -> None:
    body = {**PROJECT, "manager_email": "not-an-email"}
    assert _refusal(ProjectCreate, body) == (("manager_email",), "employee_email.invalid")


def test_a_change_names_only_what_it_changes() -> None:
    change = ProjectChange.model_validate({"end_date": "2027-06-30", "active": False})
    assert change.model_fields_set == {"end_date", "active"}


@pytest.mark.parametrize(
    ("body", "loc", "code"),
    [
        ({"code": " "}, ("code",), "project_code.blank"),
        ({"code": None}, ("code",), "project_code.blank"),
        ({"name": None}, ("name",), "project_name.blank"),
        ({"manager_email": None}, ("manager_email",), "employee_email.blank"),
        ({"manager_email": "x@y"}, ("manager_email",), "employee_email.invalid"),
        ({"active": None}, ("active",), "request.invalid_field"),
        ({"start_date": None}, ("start_date",), "request.invalid_field"),
        ({"end_date": None}, ("end_date",), "request.invalid_field"),
        (
            {"start_date": "2026-09-01", "end_date": "2026-08-31"},
            ("end_date",),
            "project_dates.order",
        ),
    ],
)
def test_a_change_breaking_a_rule(body: dict[str, Any], loc: tuple[str], code: str) -> None:
    assert _refusal(ProjectChange, body) == (loc, code)


def test_a_changed_manager_is_normalised() -> None:
    change = ProjectChange.model_validate({"manager_email": " Piotr@Example.com "})
    assert change.manager_email == "piotr@example.com"


def test_a_product_with_and_without_a_jira_board() -> None:
    assert ProductCreate.model_validate({**PRODUCT, "jira_url": JIRA}).jira_url == JIRA
    assert ProductCreate.model_validate(PRODUCT).jira_url is None
    assert ProductCreate.model_validate({**PRODUCT, "jira_url": "  "}).jira_url is None


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ("", "product_name.blank"),
        (None, "product_name.blank"),
        ("x" * (PRODUCT_NAME_MAX_LENGTH + 1), "product_name.too_long"),
    ],
)
def test_blank_and_long_product_names(value: Any, code: str) -> None:
    assert _refusal(ProductCreate, {**PRODUCT, "name": value}) == (("name",), code)


@pytest.mark.parametrize(
    ("url", "code"),
    [
        ("jira/board/17", "product_jira_url.invalid"),
        ("/secure/RapidBoard.jspa", "product_jira_url.invalid"),
        ("ftp://jira.example.com", "product_jira_url.invalid"),
        ("https://", "product_jira_url.invalid"),
        ("https://jira.example.com/a b", "product_jira_url.invalid"),
        ("https://[::1", "product_jira_url.invalid"),
        (
            "https://jira.example.com/" + "x" * PRODUCT_JIRA_URL_MAX_LENGTH,
            "product_jira_url.too_long",
        ),
    ],
)
def test_jira_links_that_are_not_web_addresses(url: str, code: str) -> None:
    assert _refusal(ProductCreate, {**PRODUCT, "jira_url": url}) == (("jira_url",), code)


def test_a_jira_link_at_the_limit() -> None:
    prefix = "http://jira.example.com/"
    url = prefix + "x" * (PRODUCT_JIRA_URL_MAX_LENGTH - len(prefix))
    assert ProductCreate.model_validate({**PRODUCT, "jira_url": url}).jira_url == url


def test_a_products_link_is_cleared_by_null() -> None:
    change = ProductChange.model_validate({"jira_url": None})
    assert change.model_fields_set == {"jira_url"}
    assert change.jira_url is None


@pytest.mark.parametrize(
    ("body", "loc", "code"),
    [
        ({"name": None}, ("name",), "product_name.blank"),
        ({"owner_email": None}, ("owner_email",), "employee_email.blank"),
        ({"active": None}, ("active",), "request.invalid_field"),
        ({"jira_url": "ftp://x.example.com"}, ("jira_url",), "product_jira_url.invalid"),
    ],
)
def test_a_product_change_breaking_a_rule(body: dict[str, Any], loc: tuple[str], code: str) -> None:
    assert _refusal(ProductChange, body) == (loc, code)
