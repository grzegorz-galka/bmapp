"""Business logic, callable without HTTP."""

from app.services.teams import list_teams, register_team

__all__ = ["list_teams", "register_team"]
