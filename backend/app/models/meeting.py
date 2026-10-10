"""Persistence model for the board meetings a team holds."""

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.time import ORGANIZATION_TZ, ORGANIZATION_TZ_NAME
from app.models.employee import EMAIL_MAX_LENGTH, Employee

#: The meeting's date as the organization reads it. Repeated as SQL because a
#: date taken from a UTC instant would put a late-evening meeting on the next
#: day; the index below is what "one meeting per team per date" rests on.
LOCAL_DATE_SQL = f"((starts_at AT TIME ZONE '{ORGANIZATION_TZ_NAME}')::date)"


class Meeting(Base):
    """One occurrence of a team's board meeting."""

    __tablename__ = "meetings"
    __table_args__ = (
        # Enforced here rather than by a read-then-write check in the service,
        # which would race: two members opening the same week at once.
        Index("uq_meetings_team_local_date", "team_id", text(LOCAL_DATE_SQL), unique=True),
        Index("ix_meetings_host_employee_id", "host_employee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    starts_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # RESTRICT, as for memberships: a host must keep resolving to someone,
    # including after they have left the team.
    host_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    #: Who opened it, for auditing - the one piece of personal data kept.
    created_by_email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), nullable=False)

    host: Mapped[Employee | None] = relationship(lazy="joined")

    @property
    def local_start(self) -> datetime.datetime:
        """The start as the organization's clock shows it."""
        return self.starts_at.astimezone(ORGANIZATION_TZ)

    @property
    def date(self) -> datetime.date:
        return self.local_start.date()

    @property
    def time(self) -> datetime.time:
        return self.local_start.time().replace(tzinfo=None)
