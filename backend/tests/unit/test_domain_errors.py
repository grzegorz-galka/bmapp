"""Each domain error maps to its status and error body through the one handler."""

import json
import uuid

import pytest

from app.core.exceptions import (
    CorrectionReasonBlankError,
    DomainError,
    DuplicateMemberError,
    DuplicateMetricNameError,
    LeaderNotMemberError,
    LeaderRemovalError,
    MeetingDateTakenError,
    MeetingFrozenError,
    MeetingHasValuesError,
    MeetingHostNotMemberError,
    MeetingNotFoundError,
    MemberNotFoundError,
    MetricDirectionImmutableError,
    MetricHasValuesError,
    MetricNotFoundError,
    MetricOwnerNotMemberError,
    MetricRetiredError,
    TeamNotFoundError,
    ThresholdOrderError,
    ThresholdShapeError,
)
from app.main import handle_domain_error

SOME_ID = uuid.uuid4()


@pytest.mark.parametrize(
    ("error", "status", "field", "code"),
    [
        (TeamNotFoundError(SOME_ID), 404, None, "team.not_found"),
        (DuplicateMemberError("a@b.c"), 409, "email", "team_member.duplicate"),
        (MemberNotFoundError(SOME_ID), 404, None, "team_member.not_found"),
        (LeaderRemovalError(), 409, None, "team_member.is_leader"),
        (LeaderNotMemberError(SOME_ID), 409, "employee_id", "team_leader.not_member"),
        (MeetingDateTakenError("2026-10-14"), 409, "date", "meeting_date.taken"),
        (MeetingNotFoundError(SOME_ID), 404, None, "meeting.not_found"),
        (MeetingHostNotMemberError(SOME_ID), 409, "host_employee_id", "meeting_host.not_member"),
        (MeetingHasValuesError(SOME_ID), 409, None, "meeting.has_values"),
        (DuplicateMetricNameError("Revenue"), 409, "name", "metric_name.duplicate"),
        (MetricOwnerNotMemberError(SOME_ID), 409, "owner_employee_id", "metric_owner.not_member"),
        (MetricDirectionImmutableError(), 409, "direction", "metric_direction.immutable"),
        (MetricNotFoundError(SOME_ID), 404, None, "metric.not_found"),
        (MetricRetiredError(SOME_ID), 409, None, "metric.retired"),
        (MetricHasValuesError(SOME_ID), 409, None, "metric.has_values"),
        (ThresholdOrderError(), 422, None, "threshold.order_invalid"),
        (ThresholdShapeError("green_hi", "x"), 422, "green_hi", "request.invalid_field"),
        (MeetingFrozenError(SOME_ID), 409, None, "metric_value.meeting_frozen"),
        (CorrectionReasonBlankError(), 422, "reason", "metric_value_reason.blank"),
    ],
)
def test_maps_to_its_status_and_body(
    error: DomainError, status: int, field: str | None, code: str
) -> None:
    response = handle_domain_error(None, error)  # type: ignore[arg-type]

    assert response.status_code == status
    body = json.loads(bytes(response.body))
    assert body == {"errors": [{"field": field, "code": code, "message": error.message}]}
    assert error.message
