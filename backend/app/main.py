"""Application entry point: routers, CORS and the one exception handler."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health_router, teams_router
from app.core.config import get_settings
from app.core.exceptions import GENERIC_ERROR_CODE, DomainError

settings = get_settings()
logging.basicConfig(level=settings.log_level)

app = FastAPI(title="BMAPP", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
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
