"""Domain exceptions.

Services raise these; a single handler registered in `app.main` maps them to
HTTP responses, so no router decides a status code for itself.
"""


class DomainError(Exception):
    """Base class for errors that carry a domain meaning.

    `field` names the input responsible, so the API can return the same shape
    of error body for a domain failure as for a schema validation failure.
    """

    status_code = 400
    field: str | None = None

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if field is not None:
            self.field = field


class DuplicateTeamNameError(DomainError):
    """Raised when a team name is already in use, ignoring case."""

    status_code = 409
    field = "name"

    def __init__(self, name: str) -> None:
        super().__init__(f"A team named {name!r} already exists.")
