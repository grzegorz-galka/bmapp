"""The dashboard endpoint: everything the landing page shows, in one response."""

from fastapi import APIRouter

from app.api.dependencies import AuthenticatedPersonDependency, SessionDependency
from app.schemas import DashboardSummary
from app.services import build_dashboard_summary, today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "",
    response_model=DashboardSummary,
    summary="The dashboard summary",
    description=(
        "Everything the landing page shows as data, for the signed-in caller: the "
        "company declarations, the caller's teams and their board meetings from "
        "today on, the problem and task funnel of those teams, and the items the "
        "caller is responsible for. Read-only: a meeting the schedule proposes is "
        "returned without a `meeting_id`, not opened."
    ),
)
def get_dashboard_summary(
    person: AuthenticatedPersonDependency, session: SessionDependency
) -> DashboardSummary:
    """Return the dashboard summary as of today, for the person signed in.

    Requires a token: the identity it carries is the caller's, so an
    unauthenticated request has no summary to be given. The caller is matched
    to their teams and items by the token's email, not through `CurrentUser`,
    which would cost a statement to look up an employee the queries join anyway.
    """
    return build_dashboard_summary(session, today(), person.email)
