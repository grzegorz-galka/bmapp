"""Each domain error maps to its status and error body through the one handler."""

import json
import uuid

import pytest

from app.core.exceptions import (
    CorrectionReasonBlankError,
    DomainError,
    DuplicateMemberError,
    DuplicateMetricNameError,
    GlobalMetricAlreadyIncludedError,
    GlobalMetricReadOnlyError,
    IncorrectDevPasswordError,
    ItemMetricNotOnBoardError,
    ItemResponsibleNotMemberError,
    LeaderNotMemberError,
    LeaderRemovalError,
    MeetingDateTakenError,
    MeetingFrozenError,
    MeetingHasPulseAnswersError,
    MeetingHasValuesError,
    MeetingHostNotMemberError,
    MeetingNotFoundError,
    MemberNotFoundError,
    MetricCopySourceGlobalError,
    MetricDirectionImmutableError,
    MetricHasValuesError,
    MetricNotFoundError,
    MetricOwnerNotMemberError,
    MetricRetiredError,
    ProblemArchivedError,
    ProblemNotFoundError,
    PulseAnswerMeetingFrozenError,
    TaskArchivedError,
    TaskNotFoundError,
    TaskProblemArchivedError,
    TaskProblemNotFoundError,
    TeamDeputyIsLeaderError,
    TeamDeputyNotMemberError,
    TeamNotFoundError,
    ThresholdOrderError,
    ThresholdShapeError,
    UnknownEmployeeError,
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
        (TeamDeputyNotMemberError(SOME_ID), 409, "employee_id", "team_deputy.not_member"),
        (TeamDeputyIsLeaderError(), 409, "employee_id", "team_deputy.is_leader"),
        (MeetingDateTakenError("2026-10-14"), 409, "date", "meeting_date.taken"),
        (MeetingNotFoundError(SOME_ID), 404, None, "meeting.not_found"),
        (MeetingHostNotMemberError(SOME_ID), 409, "host_employee_id", "meeting_host.not_member"),
        (MeetingHasValuesError(SOME_ID), 409, None, "meeting.has_values"),
        (MeetingHasPulseAnswersError(SOME_ID), 409, None, "meeting.has_pulse_answers"),
        (PulseAnswerMeetingFrozenError(SOME_ID), 409, None, "pulse_answer.meeting_frozen"),
        (DuplicateMetricNameError("Revenue"), 409, "name", "metric_name.duplicate"),
        (
            DuplicateMetricNameError("Revenue", "global_metric_id"),
            409,
            "global_metric_id",
            "metric_name.duplicate",
        ),
        (GlobalMetricReadOnlyError(), 409, None, "global_metric.read_only"),
        (GlobalMetricReadOnlyError("unit"), 409, "unit", "global_metric.read_only"),
        (
            GlobalMetricAlreadyIncludedError(SOME_ID),
            409,
            "global_metric_id",
            "global_metric.already_included",
        ),
        (
            MetricCopySourceGlobalError(SOME_ID),
            409,
            "source_metric_id",
            "metric_copy.source_global",
        ),
        (MetricOwnerNotMemberError(SOME_ID), 409, "owner_employee_id", "metric_owner.not_member"),
        (MetricDirectionImmutableError(), 409, "direction", "metric_direction.immutable"),
        (MetricNotFoundError(SOME_ID), 404, None, "metric.not_found"),
        (MetricRetiredError(SOME_ID), 409, None, "metric.retired"),
        (MetricHasValuesError(SOME_ID), 409, None, "metric.has_values"),
        (ThresholdOrderError(), 422, None, "threshold.order_invalid"),
        (ThresholdShapeError("green_hi", "x"), 422, "green_hi", "request.invalid_field"),
        (MeetingFrozenError(SOME_ID), 409, None, "metric_value.meeting_frozen"),
        (CorrectionReasonBlankError(), 422, "reason", "metric_value_reason.blank"),
        (IncorrectDevPasswordError(), 401, "password", "auth.password_incorrect"),
        (UnknownEmployeeError("a@b.c"), 401, "email", "auth.employee_unknown"),
        (
            ItemResponsibleNotMemberError(SOME_ID),
            409,
            "responsible_employee_id",
            "item_responsible.not_member",
        ),
        (ItemMetricNotOnBoardError(SOME_ID), 409, "metric_id", "item_metric.not_on_board"),
        (TaskProblemNotFoundError(SOME_ID), 409, "problem_id", "task_problem.not_found"),
        (TaskProblemArchivedError(SOME_ID), 409, "problem_id", "task_problem.archived"),
        (ProblemNotFoundError(SOME_ID), 404, None, "problem.not_found"),
        (TaskNotFoundError(SOME_ID), 404, None, "task.not_found"),
        (ProblemArchivedError(SOME_ID), 409, None, "problem.archived"),
        (TaskArchivedError(SOME_ID), 409, None, "task.archived"),
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
