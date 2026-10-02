"""Each membership error maps to its status and error body through the one handler."""

import json
import uuid

import pytest

from app.core.exceptions import (
    DomainError,
    DuplicateMemberError,
    LeaderNotMemberError,
    LeaderRemovalError,
    MemberNotFoundError,
    TeamNotFoundError,
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
