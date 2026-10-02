"""Business logic for employees, who are recorded on first assignment to a team.

No HTTP, and no session lifecycle: the caller provides the session.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Employee


def get_or_create_employee(session: Session, email: str) -> Employee:
    """Return the employee with this (already normalised) email, recording them if new.

    Inserts with ON CONFLICT DO NOTHING and then reads, rather than reading
    first: two concurrent first assignments of the same email both end up
    with the one row instead of one failing on the unique constraint.

    Never commits. The insert belongs to the caller's transaction, so a
    rejected registration or addition rolls the new employee back with it.
    """
    session.execute(
        insert(Employee).values(email=email).on_conflict_do_nothing(index_elements=["email"])
    )
    return session.scalars(select(Employee).where(Employee.email == email)).one()
