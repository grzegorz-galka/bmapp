"""Pydantic request and response models."""

from app.schemas.employee import EmployeeEmail, normalise_email
from app.schemas.hub import (
    AssignedItem,
    BoardReadiness,
    CurrentUser,
    Declarations,
    Funnel,
    FunnelStage,
    HubSummary,
    HubTeam,
    LocalizedText,
    PreparationCounts,
)
from app.schemas.team import (
    BoardRead,
    LeaderChange,
    LeaderRead,
    MemberAdd,
    MemberRead,
    TeamCreate,
    TeamDetail,
    TeamRead,
)

__all__ = [
    "AssignedItem",
    "BoardRead",
    "BoardReadiness",
    "CurrentUser",
    "Declarations",
    "EmployeeEmail",
    "Funnel",
    "FunnelStage",
    "HubSummary",
    "HubTeam",
    "LeaderChange",
    "LeaderRead",
    "LocalizedText",
    "MemberAdd",
    "MemberRead",
    "PreparationCounts",
    "TeamCreate",
    "TeamDetail",
    "TeamRead",
    "normalise_email",
]
