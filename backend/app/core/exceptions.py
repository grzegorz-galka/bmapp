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
