"""The hub endpoint: everything the landing page shows, in one response."""

import datetime

from fastapi import APIRouter

from app.schemas import HubSummary
from app.services import build_hub_summary

router = APIRouter(prefix="/hub", tags=["hub"])


@router.get(
    "",
    response_model=HubSummary,
    summary="The hub summary",
    description=(
        "Everything the landing page shows as data. **Provisional**: the figures are "
        "placeholder data, not anything recorded. Each will be replaced by the real "
        "capability - meetings, metrics, problems, tasks - as it is built."
    ),
)
def get_hub_summary() -> HubSummary:
    """Return the hub summary as of now.

    No database session: the hub is built from constants, so the shell stays
    reviewable whether or not PostgreSQL is up.
    """
    return build_hub_summary(datetime.datetime.now(datetime.UTC))
