"""FastAPI routers, one module per resource."""

from app.api.auth import router as auth_router
from app.api.global_metrics import router as global_metrics_router
from app.api.health import router as health_router
from app.api.hub import router as hub_router
from app.api.meetings import router as meetings_router
from app.api.metric_values import router as metric_values_router
from app.api.metrics import router as metrics_router
from app.api.problems import router as problems_router
from app.api.pulse import router as pulse_router
from app.api.tasks import router as tasks_router
from app.api.teams import router as teams_router

__all__ = [
    "auth_router",
    "global_metrics_router",
    "health_router",
    "hub_router",
    "meetings_router",
    "metric_values_router",
    "metrics_router",
    "problems_router",
    "pulse_router",
    "tasks_router",
    "teams_router",
]
