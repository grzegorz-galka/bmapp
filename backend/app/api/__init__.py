"""FastAPI routers, one module per resource."""

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.hub import router as hub_router
from app.api.teams import router as teams_router

__all__ = ["auth_router", "health_router", "hub_router", "teams_router"]
