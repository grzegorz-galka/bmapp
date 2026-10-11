"""Persistence model for the pulse check: each member's answer at one meeting."""

import datetime
import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.employee import Employee

PULSE_RATING_MIN = 1
PULSE_RATING_MAX = 5
PULSE_TEXT_MAX_LENGTH = 2000


def _text_length_check(column: str) -> CheckConstraint:
    return CheckConstraint(
        f"char_length({column}) <= {PULSE_TEXT_MAX_LENGTH}",
        name=f"ck_pulse_answers_{column}_length",
    )


class PulseAnswer(Base):
    """One member's rating and three short texts for one meeting."""

    __tablename__ = "pulse_answers"
    __table_args__ = (
        # The database decides "one answer per member per meeting": recording
        # is an upsert on this pair, so two tabs saving at once cannot race.
        UniqueConstraint("meeting_id", "employee_id", name="uq_pulse_answers_meeting_employee"),
        CheckConstraint(
            f"rating BETWEEN {PULSE_RATING_MIN} AND {PULSE_RATING_MAX}",
            name="ck_pulse_answers_rating",
        ),
        _text_length_check("positive"),
        _text_length_check("negative"),
        _text_length_check("better"),
        # The unique pair serves lookups by meeting; this one serves the
        # RESTRICT check when an employee row is deleted.
        Index("ix_pulse_answers_employee_id", "employee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # RESTRICT on the meeting backs up the service's refusal to delete a
    # meeting with answers, as the metric values' foreign key does for values.
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="RESTRICT"), nullable=False
    )
    # The employee, not an email: the missing list is computed from
    # team_members by employee id. RESTRICT keeps an answer attributable.
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Not nullable: a blank answer is '', so readers never tell NULL from empty.
    positive: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    negative: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    better: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped[Employee] = relationship(lazy="joined")

    @property
    def email(self) -> str:
        return self.employee.email
