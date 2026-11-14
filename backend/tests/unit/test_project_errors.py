"""The projects and products errors map to their status and error body through the one handler."""

import json
import uuid

import pytest

from app.core.exceptions import (
    DerivationProductMetricError,
    DerivationProjectMetricError,
    DomainError,
    DuplicateProductNameError,
    DuplicateProjectCodeError,
    MetricCopySourceProductError,
    MetricCopySourceProjectError,
    MetricProjectAndProductError,
    ProductHasValuesError,
    ProductNotFoundError,
    ProjectDatesOrderError,
    ProjectHasValuesError,
    ProjectNotFoundError,
)
from app.main import handle_domain_error

SOME_ID = uuid.uuid4()


@pytest.mark.parametrize(
    ("error", "status", "field", "code"),
    [
        (DuplicateProjectCodeError("PRJ-042"), 409, "code", "project_code.duplicate"),
        (ProjectDatesOrderError(), 422, "end_date", "project_dates.order"),
        (ProjectNotFoundError(SOME_ID), 404, "project_id", "project.not_found"),
        (ProjectHasValuesError(SOME_ID), 409, None, "project.has_values"),
        (DuplicateProductNameError("Portal"), 409, "name", "product_name.duplicate"),
        (ProductNotFoundError(SOME_ID), 404, "product_id", "product.not_found"),
        (ProductHasValuesError(SOME_ID), 409, None, "product.has_values"),
        (MetricProjectAndProductError(), 422, "project_id", "metric.project_and_product"),
        (DerivationProjectMetricError(), 409, "derivation", "derivation.project_metric"),
        (DerivationProductMetricError(), 409, "derivation", "derivation.product_metric"),
        (
            MetricCopySourceProjectError(SOME_ID),
            409,
            "source_metric_id",
            "metric_copy.source_project",
        ),
        (
            MetricCopySourceProductError(SOME_ID),
            409,
            "source_metric_id",
            "metric_copy.source_product",
        ),
    ],
)
def test_maps_to_its_status_and_body(
    error: DomainError, status: int, field: str | None, code: str
) -> None:
    response = handle_domain_error(None, error)  # type: ignore[arg-type]

    assert response.status_code == status
    body = json.loads(bytes(response.body))
    assert body == {"errors": [{"field": field, "code": code, "message": error.message}]}
