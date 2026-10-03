"""The hub endpoint: everything the landing page shows, in one response."""

import datetime

from fastapi import APIRouter

from app.api.dependencies import AuthenticatedPersonDependency
from app.schemas import HubSummary
from app.services import build_hub_summary

router = APIRouter(prefix="/hub", tags=["hub"])


@router.get(
    "",
    response_model=HubSummary,
    summary="The hub summary",
    description=(
        "Everything the landing page shows as data, for the signed-in caller. "
        "**Provisional**: the figures are "
        "placeholder data, not anything recorded. Each will be replaced by the real "
        "capability - meetings, metrics, problems, tasks - as it is built."
    ),
)
def get_hub_summary(person: AuthenticatedPersonDependency) -> HubSummary:
    """Return the hub summary as of now, for the person signed in.

    Requires a token: the identity it carries is the caller's, so an
    unauthenticated request has no summary to be given. Still no database
    session - the token is all this needs - so the shell stays reviewable
    whether or not PostgreSQL is up.
    """
    return build_hub_summary(datetime.datetime.now(datetime.UTC), person.email)
