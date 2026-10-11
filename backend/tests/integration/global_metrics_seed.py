"""Global metrics set up directly in the database, and included through the board's API.

The catalogue has its own API; tests of a board's side of global metrics seed
the catalogue here, so they depend only on what they test.
"""

import datetime
import uuid
from decimal import Decimal
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.metric_enums import Direction
from app.models import Metric, MetricThreshold

CATALOGUE_EMAIL = "catalogue@example.com"


def seed_global_metric(
    session: Session,
    name: str = "Service availability",
    *,
    unit: str = "%",
    decimals: int = 2,
    direction: Direction = Direction.HIGHER_IS_BETTER,
    retired: bool = False,
) -> str:
    """Add a global metric to the catalogue and return its identifier."""
    metric = Metric(
        team_id=None,
        name=name,
        unit=unit,
        decimals=decimals,
        direction=direction,
        retired=retired,
    )
    session.add(metric)
    session.commit()
    return str(metric.id)


def seed_global_threshold(
    session: Session,
    metric_id: str,
    effective_from: str = "2026-01-01",
    reason: str = "Plan",
    **bounds: str,
) -> None:
    """Record a threshold version of a global metric, as the catalogue would."""
    session.add(
        MetricThreshold(
            metric_id=uuid.UUID(metric_id),
            effective_from=datetime.date.fromisoformat(effective_from),
            reason=reason,
            recorded_by_email=CATALOGUE_EMAIL,
            **{key: Decimal(value) for key, value in bounds.items()},
        )
    )
    session.commit()


def retire_in_catalogue(session: Session, metric_id: str) -> None:
    """Retire a global metric in the catalogue, as an administrator would."""
    metric = session.get(Metric, uuid.UUID(metric_id))
    assert metric is not None
    metric.retired = True
    session.commit()


def include(client: TestClient, team_id: str, global_metric_id: str, **fields: Any) -> Any:
    """Include a global metric in a board and return it, failing the test if refused."""
    response = client.post(
        f"/teams/{team_id}/metrics/inclusions",
        json={"global_metric_id": global_metric_id, **fields},
    )
    assert response.status_code == 201, response.json()
    return response.json()
