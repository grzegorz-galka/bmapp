"""Domain exceptions.

Services raise these; a single handler registered in `app.main` maps them to
HTTP responses, so no router decides a status code for itself.
"""

#: Code reported when a request fails before any domain rule could be applied.
GENERIC_ERROR_CODE = "request.invalid_field"


class DomainError(Exception):
    """Base class for errors that carry a domain meaning.

    `field` names the input responsible, so the API can return the same shape
    of error body for a domain failure as for a schema validation failure.

    `code` names the reason in a form a client can map to its own wording. It
    is part of the published API: clients key their translations on it, so a
    code is never renamed once released.
    """

    status_code = 400
    field: str | None = None
    code: str = GENERIC_ERROR_CODE

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if field is not None:
            self.field = field


class UnauthenticatedError(DomainError):
    """Raised when a request carries no token, or none that can be verified.

    Always 401, never 403: the caller has not established who they are, so the
    answer is "authenticate", not "you may not". The code names which of the
    three it was, and the message never says which key, issuer or audience was
    expected - that would tell an attacker what to forge.
    """

    status_code = 401
    code = "auth.token_invalid"

    def __init__(self, message: str = "The access token could not be verified.") -> None:
        super().__init__(message)


class MissingTokenError(UnauthenticatedError):
    """Raised when a request that needs an identity presents no token at all."""

    code = "auth.token_missing"

    def __init__(self) -> None:
        super().__init__("No access token was presented.")


class ExpiredTokenError(UnauthenticatedError):
    """Raised when a token verified but its lifetime has passed."""

    code = "auth.token_expired"

    def __init__(self) -> None:
        super().__init__("The access token has expired.")


class ForbiddenError(DomainError):
    """Raised when an authenticated person may not do what they are asking.

    403 rather than 404: every authenticated person may read everything here,
    so there is nothing to conceal by pretending the team does not exist.
    """

    status_code = 403
    code = "auth.forbidden"

    def __init__(self, message: str = "You are not permitted to perform this action.") -> None:
        super().__init__(message)


class NotAnEmployeeError(ForbiddenError):
    """Raised when a write needs an employee record and the caller has none.

    Authenticating does not record an employee: people are recorded the first
    time they are assigned to a team. Someone on no team can read everything
    and write nothing.
    """

    code = "auth.not_an_employee"

    def __init__(self, email: str) -> None:
        super().__init__(f"{email} is not a member of any team, so may not write.")


class DuplicateTeamNameError(DomainError):
    """Raised when a team name is already in use, ignoring case."""

    status_code = 409
    field = "name"
    code = "team_name.duplicate"

    def __init__(self, name: str) -> None:
        super().__init__(f"A team named {name!r} already exists.")


class TeamNotFoundError(DomainError):
    """Raised when a team identifier matches no team."""

    status_code = 404
    code = "team.not_found"

    def __init__(self, team_id: object) -> None:
        super().__init__(f"No team has the identifier {team_id}.")


class DuplicateMemberError(DomainError):
    """Raised when an employee added to a team already belongs to it."""

    status_code = 409
    field = "email"
    code = "team_member.duplicate"

    def __init__(self, email: str) -> None:
        super().__init__(f"{email} is already a member of this team.")


class MemberNotFoundError(DomainError):
    """Raised when an employee removed from a team does not belong to it."""

    status_code = 404
    code = "team_member.not_found"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class LeaderRemovalError(DomainError):
    """Raised when the team's leader is removed before handing over."""

    status_code = 409
    code = "team_member.is_leader"

    def __init__(self) -> None:
        super().__init__("The team's leader cannot be removed; hand the leadership over first.")


class LeaderNotMemberError(DomainError):
    """Raised when someone outside a team is made its leader."""

    status_code = 409
    field = "employee_id"
    code = "team_leader.not_member"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class MeetingDateTakenError(DomainError):
    """Raised when a team already holds a meeting on the date asked for."""

    status_code = 409
    field = "date"
    code = "meeting_date.taken"

    def __init__(self, date: object) -> None:
        super().__init__(f"This team already holds a meeting on {date}.")


class MeetingNotFoundError(DomainError):
    """Raised when a meeting identifier names no meeting of the team in the path.

    A meeting of another team is "not found" too, so a guessed identifier
    says nothing about which team it belongs to.
    """

    status_code = 404
    code = "meeting.not_found"

    def __init__(self, meeting_id: object) -> None:
        super().__init__(f"This team has no meeting with the identifier {meeting_id}.")


class MeetingHostNotMemberError(DomainError):
    """Raised when someone outside a team is named host of one of its meetings."""

    status_code = 409
    field = "host_employee_id"
    code = "meeting_host.not_member"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class MeetingHasValuesError(DomainError):
    """Raised when a meeting with recorded values is deleted or moved to another date.

    Its values are judged against the thresholds in force on its date, so the
    date is part of what was recorded.
    """

    status_code = 409
    code = "meeting.has_values"

    def __init__(self, meeting_id: object) -> None:
        super().__init__(f"Meeting {meeting_id} has recorded metric values.")


class DuplicateMetricNameError(DomainError):
    """Raised when a board already has a metric of that name, ignoring case."""

    status_code = 409
    field = "name"
    code = "metric_name.duplicate"

    def __init__(self, name: str) -> None:
        super().__init__(f"This board already has a metric named {name!r}.")


class MetricOwnerNotMemberError(DomainError):
    """Raised when someone outside a team is named owner of one of its metrics."""

    status_code = 409
    field = "owner_employee_id"
    code = "metric_owner.not_member"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class MetricDirectionImmutableError(DomainError):
    """Raised when a request changes a metric's direction.

    What "better" means is fixed when a metric is added: every threshold
    version and every change between meetings is read through it.
    """

    status_code = 409
    field = "direction"
    code = "metric_direction.immutable"

    def __init__(self) -> None:
        super().__init__("A metric's direction cannot change; add a new metric instead.")


class MetricNotFoundError(DomainError):
    """Raised when a metric identifier names no metric of the team in the path."""

    status_code = 404
    code = "metric.not_found"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"This team has no metric with the identifier {metric_id}.")


class MetricRetiredError(DomainError):
    """Raised when a value is recorded for a retired metric."""

    status_code = 409
    code = "metric.retired"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"Metric {metric_id} is retired and accepts no values.")


class MetricHasValuesError(DomainError):
    """Raised when a metric with recorded values is deleted; retire it instead."""

    status_code = 409
    code = "metric.has_values"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"Metric {metric_id} has recorded values; retire it instead.")


class ThresholdOrderError(DomainError):
    """Raised when a threshold's amber boundary is better than its green one."""

    status_code = 422
    code = "threshold.order_invalid"

    def __init__(self) -> None:
        super().__init__("The amber zone must contain the green zone.")


class ThresholdShapeError(DomainError):
    """Raised when a threshold's boundaries do not fit its metric's direction.

    A malformed request rather than a rule a person can break from the
    interface, so it reports the general code against the offending field.
    """

    status_code = 422

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message, field)


class MeetingFrozenError(DomainError):
    """Raised when a value is recorded at a meeting outside the editing window.

    A domain rule rather than a permission refusal: an administrator is let
    through it, but only as a correction with a reason.
    """

    status_code = 409
    code = "metric_value.meeting_frozen"

    def __init__(self, meeting_id: object) -> None:
        super().__init__(f"Meeting {meeting_id} can no longer be edited.")


class CorrectionReasonBlankError(DomainError):
    """Raised when an administrator corrects a frozen value without a reason."""

    status_code = 422
    field = "reason"
    code = "metric_value_reason.blank"

    def __init__(self) -> None:
        super().__init__("A correction to a frozen value needs a reason.")
