"""Each domain error maps to its status and error body through the one handler."""

import json
import uuid

import pytest

from app.core.exceptions import (
    CorrectionReasonBlankError,
    DerivationIncompleteError,
    DerivationNoneError,
    DerivationPreviousMissingError,
    DerivationSourceCountError,
    DerivationSourceDuplicateError,
    DerivationSourceMissingError,
    DerivationSourceNotFoundError,
    DerivationSourceSelfError,
    DerivedValueOutOfRangeError,
    DevPasswordTooShortError,
    DevPasswordUnchangedError,
    DomainError,
    DuplicateMemberError,
    DuplicateMetricNameError,
    EmployeeNameTooLongError,
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
    MetricDerivationSourceError,
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
    ThresholdToleranceNegativeError,
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
        (MetricDerivationSourceError(SOME_ID), 409, None, "metric.derivation_source"),
        (
            DerivationSourceCountError("delta", 2),
            422,
            "derivation.sources",
            "derivation.source_count",
        ),
        (
            DerivationSourceNotFoundError(1, SOME_ID, SOME_ID),
            422,
            "derivation.sources[1]",
            "derivation_source.not_found",
        ),
        (DerivationSourceSelfError(0), 422, "derivation.sources[0]", "derivation_source.self"),
        (
            DerivationSourceDuplicateError(2),
            422,
            "derivation.sources[2]",
            "derivation_source.duplicate",
        ),
        (DerivationNoneError(SOME_ID), 404, None, "derivation.none"),
        (
            DerivationSourceMissingError(3, "CKI-P", "OTIF-Etap"),
            409,
            "sources[3]",
            "derivation.source_missing",
        ),
        (
            DerivationPreviousMissingError("CKI-P", "Zatrudnienie"),
            409,
            "sources[0]",
            "derivation.previous_missing",
        ),
        (DerivedValueOutOfRangeError(), 409, None, "metric_value.out_of_range"),
        (ThresholdOrderError(), 422, None, "threshold.order_invalid"),
        (ThresholdShapeError("green_hi", "x"), 422, "green_hi", "request.invalid_field"),
        (
            ThresholdToleranceNegativeError("green_pct"),
            422,
            "green_pct",
            "threshold_tolerance.negative",
        ),
        (MeetingFrozenError(SOME_ID), 409, None, "metric_value.meeting_frozen"),
        (CorrectionReasonBlankError(), 422, "reason", "metric_value_reason.blank"),
        (IncorrectDevPasswordError(), 401, "password", "auth.password_incorrect"),
        (UnknownEmployeeError("a@b.c"), 401, "email", "auth.employee_unknown"),
        (DevPasswordTooShortError(8), 422, "new_password", "dev_password.too_short"),
        (DevPasswordUnchangedError(), 422, "new_password", "dev_password.unchanged"),
        (EmployeeNameTooLongError("name", 100), 422, "name", "employee_name.too_long"),
        (EmployeeNameTooLongError("surname", 100), 422, "surname", "employee_name.too_long"),
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


def test_a_derivation_missing_several_pieces_lists_each_one() -> None:
    missing: list[DomainError] = [
        DerivationSourceMissingError(0, "Zarząd", "OTIF E: BPW"),
        DerivationPreviousMissingError("Zarząd", "OTIF E: BPW"),
        DerivationSourceMissingError(2, "CKI-S", "OTIF-Etap"),
    ]

    response = handle_domain_error(None, DerivationIncompleteError(missing))  # type: ignore[arg-type]

    assert response.status_code == 409
    body = json.loads(bytes(response.body))
    assert [(e["field"], e["code"]) for e in body["errors"]] == [
        ("sources[0]", "derivation.source_missing"),
        ("sources[0]", "derivation.previous_missing"),
        ("sources[2]", "derivation.source_missing"),
    ]
    assert all(entry["message"] for entry in body["errors"])
