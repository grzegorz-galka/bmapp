"""Business logic, callable without HTTP."""

from app.services.dashboard import build_dashboard_summary
from app.services.employees import get_or_create_employee
from app.services.meetings import (
    MeetingOverview,
    change_meeting,
    delete_meeting,
    list_meetings,
    open_meeting,
    today,
)
from app.services.teams import (
    add_member,
    change_leader,
    get_team,
    list_teams,
    register_team,
    remove_member,
    set_schedule,
)

__all__ = [
    "MeetingOverview",
    "add_member",
    "build_dashboard_summary",
    "change_leader",
    "change_meeting",
    "delete_meeting",
    "get_or_create_employee",
    "get_team",
    "list_meetings",
    "list_teams",
    "open_meeting",
    "register_team",
    "remove_member",
    "set_schedule",
    "today",
]
