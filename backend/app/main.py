"""Application entry point: routers, CORS and the one exception handler."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth_router, health_router, hub_router, teams_router
from app.core.config import Mode, get_settings
from app.core.exceptions import GENERIC_ERROR_CODE, DomainError

settings = get_settings()
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


def _refuse_dev_mode_in_a_deployed_environment() -> None:
    """Stop at boot if development mode is paired with a real identity broker.

    Dev mode mints tokens for any email with no proof of anything. Every
    deployed environment configures a broker and no local one does, so the two
    settings together can only be a mistake - and a mistake that must fail
    loudly at boot rather than quietly at the first request.

    This is a guard, not the guarantee. The guarantee is that the two modes
    accept disjoint signing algorithms, so a dev token cannot verify against a
    broker-mode server even if this check were somehow passed.
    """
    if settings.mode is Mode.DEV and settings.oidc_issuer:
        raise RuntimeError(
            "BMAPP_MODE=dev cannot be used with BMAPP_OIDC_ISSUER set: development "
            "mode issues tokens for any email without authenticating anybody. "
            "Unset one of the two."
        )


_refuse_dev_mode_in_a_deployed_environment()

# Counted, never listed: the number makes a misconfigured list visible without
# putting anyone's address in the log.
logger.info("Authorization: %d administrator(s) configured.", len(settings.admin_emails))
if settings.mode is Mode.DEV:
    logger.warning("BMAPP_MODE=dev: the local login endpoint is enabled. Never deploy this.")

app = FastAPI(title="BMAPP", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(health_router)
app.include_router(hub_router)
app.include_router(teams_router)


def _error_body(
    field: str | None, code: str, message: str
) -> dict[str, list[dict[str, str | None]]]:
    """Build the single error shape every failure response uses.

    `code` is what a client keys its own wording on; `message` is English text
    for a developer reading logs or the OpenAPI docs, not for display.
    """
    return {"errors": [{"field": field, "code": code, "message": message}]}


@app.exception_handler(DomainError)
def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
    """Map a domain exception to its status code and the shared error body."""
    return JSONResponse(
        status_code=error.status_code,
        content=_error_body(error.field, error.code, error.message),
    )


def _validation_code(error_type: str) -> str:
    """Read the published code out of a Pydantic error `type`.

    A validator that names a reason raises `PydanticCustomError`, whose type
    *is* the code. Everything else is a failure Pydantic raised before any
    validator ran - an absent field, a value of the wrong type - which no
    documented client can provoke, so it reports the one general code rather
    than leaking Pydantic's vocabulary into the API.
    """
    return error_type if "." in error_type else GENERIC_ERROR_CODE


@app.exception_handler(RequestValidationError)
def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    """Map schema validation failures to that same error body.

    Without this, a blank name and a duplicate name would come back in two
    different shapes and the frontend would need to understand both.
    """
    errors = [
        {
            # Drop the "body"/"query" prefix so the field reads as the client
            # sent it, matching what a domain error reports.
            "field": ".".join(str(part) for part in item["loc"][1:]) or None,
            "code": _validation_code(str(item["type"])),
            "message": item["msg"].removeprefix("Value error, "),
        }
        for item in error.errors()
    ]
    return JSONResponse(status_code=422, content={"errors": errors})
