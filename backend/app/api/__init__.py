"""FastAPI routers, one module per resource."""

from app.api.health import router as health_router
from app.api.teams import router as teams_router

__all__ = ["health_router", "teams_router"]
