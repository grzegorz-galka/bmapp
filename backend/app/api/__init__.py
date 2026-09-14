"""FastAPI routers, one module per resource."""

from app.api.health import router as health_router
from app.api.hub import router as hub_router
from app.api.teams import router as teams_router

__all__ = ["health_router", "hub_router", "teams_router"]
