"""Operational health endpoint."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.db import get_session

router = APIRouter(tags=["operations"])


class Health(BaseModel):
    """Liveness of the application and reachability of its database."""

    status: Literal["healthy", "unhealthy"]
    database: Literal["reachable", "unreachable"]


@router.get("/health", response_model=Health)
def get_health(response: Response, session: Annotated[Session, Depends(get_session)]) -> Health:
    """Report whether the application is up and the database answers."""
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Health(status="unhealthy", database="unreachable")
    return Health(status="healthy", database="reachable")
