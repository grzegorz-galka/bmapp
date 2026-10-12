"""The hub endpoint: everything the landing page shows, in one response."""

import datetime

from fastapi import APIRouter

from app.api.dependencies import AuthenticatedPersonDependency, SessionDependency
from app.schemas import HubSummary
from app.services import build_hub_summary

router = APIRouter(prefix="/hub", tags=["hub"])


@router.get(
    "",
    response_model=HubSummary,
    summary="The hub summary",
    description=(
        "Everything the landing page shows as data, for the signed-in caller. "
        "The funnel and the assigned items are the recorded problems and tasks. "
        "**Provisional**: the declarations, teams, preparation counts and "
        "in-session flag are placeholder data, not anything recorded. Each will be "
        "replaced by the real capability as it is built."
    ),
)
def get_hub_summary(
    person: AuthenticatedPersonDependency, session: SessionDependency
) -> HubSummary:
    """Return the hub summary as of now, for the person signed in.

    Requires a token: the identity it carries is the caller's, so an
    unauthenticated request has no summary to be given. The caller is matched
    to their items by the token's email, not through `CurrentUser`, which
    would cost a statement to look up an employee the queries join anyway.
    """
    return build_hub_summary(session, datetime.datetime.now(datetime.UTC), person.email)
