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


class IncorrectDevPasswordError(DomainError):
    """Raised when a development login gives a password not derived from its email.

    401 like the token refusals, but not one of them: no token was presented,
    and the field at fault is named. The password is derivable by anyone, so
    saying which part was wrong conceals nothing.
    """

    status_code = 401
    field = "password"
    code = "auth.password_incorrect"

    def __init__(self) -> None:
        super().__init__("The password is not the development password for this email.")


class UnknownEmployeeError(DomainError):
    """Raised when a development login names neither an employee nor an administrator."""

    status_code = 401
    field = "email"
    code = "auth.employee_unknown"

    def __init__(self, email: str) -> None:
        super().__init__(f"{email} is neither a recorded employee nor an administrator.")


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


class TeamDeputyNotMemberError(DomainError):
    """Raised when someone outside a team is appointed its deputy."""

    status_code = 409
    field = "employee_id"
    code = "team_deputy.not_member"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class TeamDeputyIsLeaderError(DomainError):
    """Raised when a team's leader is appointed its deputy."""

    status_code = 409
    field = "employee_id"
    code = "team_deputy.is_leader"

    def __init__(self) -> None:
        super().__init__("The team's leader cannot also be its deputy.")


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


class MeetingHasPulseAnswersError(DomainError):
    """Raised when a meeting with pulse answers is deleted.

    The answers are people's own statements about that week, so they are not
    discarded with the meeting. Moving it is allowed: no answer is judged
    against anything in force on its date.
    """

    status_code = 409
    code = "meeting.has_pulse_answers"

    def __init__(self, meeting_id: object) -> None:
        super().__init__(f"Meeting {meeting_id} has pulse answers.")


class DuplicateMetricNameError(DomainError):
    """Raised when a board already has a metric of that name, ignoring case.

    Its own or an included global one. Reported against `name`, or against
    whichever field brought the name in - `global_metric_id` when including.
    """

    status_code = 409
    field = "name"
    code = "metric_name.duplicate"

    def __init__(self, name: str, field: str = "name") -> None:
        super().__init__(f"This board already has a metric named {name!r}.", field)


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


class GlobalMetricReadOnlyError(DomainError):
    """Raised when a board changes a global metric's definition or records its threshold.

    A rule about the metric, not about the person - an administrator is
    refused too - so 409 rather than `auth.forbidden`: a global metric is
    changed in the catalogue, never through a board.
    """

    status_code = 409
    code = "global_metric.read_only"

    def __init__(self, field: str | None = None) -> None:
        super().__init__("A global metric's definition is changed in the catalogue.", field)


class GlobalMetricAlreadyIncludedError(DomainError):
    """Raised when a board includes a global metric it already includes."""

    status_code = 409
    field = "global_metric_id"
    code = "global_metric.already_included"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"This board already includes the global metric {metric_id}.")


class MetricCopySourceGlobalError(DomainError):
    """Raised when a global metric is copied; a board includes it instead."""

    status_code = 409
    field = "source_metric_id"
    code = "metric_copy.source_global"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"Metric {metric_id} is global; include it instead of copying it.")


class DuplicateMetricGroupNameError(DomainError):
    """Raised when a board already has a group of that name, ignoring case."""

    status_code = 409
    field = "name"
    code = "metric_group_name.duplicate"

    def __init__(self, name: str) -> None:
        super().__init__(f"This board already has a group named {name!r}.")


class MetricGroupNotFoundError(DomainError):
    """Raised when a group identifier names no group of the board in the path.

    Another board's group alike: a placement stays within its own board.
    Reported against `group_id` when a metric is placed, and against no field
    when the group is the one in the path.
    """

    status_code = 404
    code = "metric_group.not_found"

    def __init__(self, group_id: object, field: str | None = None) -> None:
        super().__init__(f"This board has no group with the identifier {group_id}.", field)


class MetricLayoutStaleError(DomainError):
    """Raised when a layout does not name the board's groups and metrics exactly once.

    The client arranged a board that has changed since it was read; applying
    part of the layout would leave an order nobody chose.
    """

    status_code = 409
    code = "metric_layout.stale"

    def __init__(self) -> None:
        super().__init__("The board's groups or metrics changed since the layout was read.")


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


class PulseAnswerMeetingFrozenError(DomainError):
    """Raised when a pulse answer is recorded at a meeting outside the answering window.

    Unlike a metric value there is no correction past it, an administrator's
    included: an answer is a person's own statement, not organizational data.
    """

    status_code = 409
    code = "pulse_answer.meeting_frozen"

    def __init__(self, meeting_id: object) -> None:
        super().__init__(f"Meeting {meeting_id} no longer takes pulse answers.")


class ItemResponsibleNotMemberError(DomainError):
    """Raised when someone outside a team is made responsible for one of its items.

    Only when the responsible person is set: someone who later leaves the
    team stays responsible for their items until someone changes it.
    """

    status_code = 409
    field = "responsible_employee_id"
    code = "item_responsible.not_member"

    def __init__(self, employee_id: object) -> None:
        super().__init__(f"Employee {employee_id} is not a member of this team.")


class ItemMetricNotOnBoardError(DomainError):
    """Raised when an item is linked to a metric its team's board does not show.

    Only when it is linked: a link stays when the metric is later retired or
    removed from the board.
    """

    status_code = 409
    field = "metric_id"
    code = "item_metric.not_on_board"

    def __init__(self, metric_id: object) -> None:
        super().__init__(f"Metric {metric_id} is not on this team's board.")


class TaskProblemNotFoundError(DomainError):
    """Raised when a task names a problem that is not one of its team's.

    Another team's problem is "not found" too, as a meeting of another team is.
    """

    status_code = 409
    field = "problem_id"
    code = "task_problem.not_found"

    def __init__(self, problem_id: object) -> None:
        super().__init__(f"This team has no problem with the identifier {problem_id}.")


class TaskProblemArchivedError(DomainError):
    """Raised when a task is raised from, or moved to, a problem already closed."""

    status_code = 409
    field = "problem_id"
    code = "task_problem.archived"

    def __init__(self, problem_id: object) -> None:
        super().__init__(f"Problem {problem_id} is closed; raise a task from an active one.")


class ProblemNotFoundError(DomainError):
    """Raised when a problem identifier names no problem of the team in the path."""

    status_code = 404
    code = "problem.not_found"

    def __init__(self, problem_id: object) -> None:
        super().__init__(f"This team has no problem with the identifier {problem_id}.")


class TaskNotFoundError(DomainError):
    """Raised when a task identifier names no task of the team in the path."""

    status_code = 404
    code = "task.not_found"

    def __init__(self, task_id: object) -> None:
        super().__init__(f"This team has no task with the identifier {task_id}.")


class ProblemArchivedError(DomainError):
    """Raised when a closed problem is changed. Archived is the only end state."""

    status_code = 409
    code = "problem.archived"

    def __init__(self, problem_id: object) -> None:
        super().__init__(f"Problem {problem_id} is closed and archived; it cannot change.")


class TaskArchivedError(DomainError):
    """Raised when a closed task is changed. Archived is the only end state."""

    status_code = 409
    code = "task.archived"

    def __init__(self, task_id: object) -> None:
        super().__init__(f"Task {task_id} is closed and archived; it cannot change.")
