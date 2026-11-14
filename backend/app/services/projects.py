"""Business logic for the projects and products a team follows.

Both kinds in one module: they share who owns them (one team), how their
status is set (by hand), and when they may be deleted (while none of their
metrics has a value). They differ in what is unique and in a few columns,
which is all the two halves below spell out separately.

No HTTP and no authorization: the router decides who may write.
"""

import datetime
import logging
import uuid

from sqlalchemy import ColumnElement, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    DuplicateProductNameError,
    DuplicateProjectCodeError,
    MetricDerivationSourceError,
    ProductHasValuesError,
    ProductNotFoundError,
    ProjectDatesOrderError,
    ProjectHasValuesError,
    ProjectNotFoundError,
    TeamNotFoundError,
)
from app.models import Metric, MetricDerivationSource, MetricValue, Product, Project, Team
from app.schemas.project import ProductChange, ProductCreate, ProjectChange, ProjectCreate
from app.services.employees import get_or_create_employee

logger = logging.getLogger(__name__)

PROJECT_CODE_UNIQUE_INDEX = "uq_projects_code_lower"
PRODUCT_NAME_UNIQUE_INDEX = "uq_products_team_name_lower"


def past_end(active: bool, end_date: datetime.date, today: datetime.date) -> bool:
    """Whether a project has run past its end: active, and ended before today.

    Ending today is not past it. An inactive project is never flagged: it
    has been dealt with, whatever its dates say.
    """
    return active and end_date < today


def _require_team(session: Session, team_id: uuid.UUID) -> None:
    if session.get(Team, team_id) is None:
        raise TeamNotFoundError(team_id)


def _any_value(session: Session, of_parent: ColumnElement[bool]) -> bool:
    """Whether any metric matching `of_parent` has a recorded value, at any team's meeting."""
    with_a_value = (
        exists().where(MetricValue.metric_id == Metric.id).where(of_parent).correlate(None)
    )
    return bool(session.scalar(select(with_a_value)))


def _refuse_removing_a_source(session: Session, of_parent: ColumnElement[bool]) -> None:
    """Refuse while any metric matching `of_parent` is a source of a derivation, any team's.

    Deleting would take the metric with it and leave a derivation that can
    never be derived; the derivation is changed first.
    """
    source = session.scalar(
        select(Metric.id)
        .join(MetricDerivationSource, MetricDerivationSource.source_metric_id == Metric.id)
        .where(of_parent)
        .limit(1)
    )
    if source is not None:
        raise MetricDerivationSourceError(source)


# --- Projects -----------------------------------------------------------------


def list_projects(session: Session, team_id: uuid.UUID) -> list[Project]:
    """The team's projects, inactive ones included, ordered by code."""
    _require_team(session, team_id)
    statement = (
        select(Project)
        .where(Project.team_id == team_id)
        .order_by(func.lower(Project.code), Project.code)
    )
    return list(session.scalars(statement).unique())


def get_project(session: Session, team_id: uuid.UUID, project_id: uuid.UUID) -> Project:
    """One project of the team; another team's is not found, as a guess would be."""
    project = session.get(Project, project_id)
    if project is None or project.team_id != team_id:
        raise ProjectNotFoundError(project_id)
    return project


def add_project(
    session: Session, team_id: uuid.UUID, payload: ProjectCreate, actor_email: str
) -> Project:
    """Add an active project, recording its manager as an employee if they are new.

    The manager is not made a member of the team, and gains no permission.
    """
    _require_team(session, team_id)
    manager = get_or_create_employee(session, payload.manager_email)
    project = Project(
        team_id=team_id,
        code=payload.code,
        name=payload.name,
        manager_employee_id=manager.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        active=True,
    )
    session.add(project)
    _commit_project(session, payload.code)
    session.refresh(project)
    logger.info("Project %s added to team %s by %s", project.id, team_id, actor_email)
    return project


def change_project(
    session: Session,
    team_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectChange,
    actor_email: str,
) -> Project:
    """Change the properties a request names, its status included; never its team."""
    project = get_project(session, team_id, project_id)
    given = payload.model_fields_set
    start_date = payload.start_date if "start_date" in given else project.start_date
    end_date = payload.end_date if "end_date" in given else project.end_date
    if start_date is not None and end_date is not None and end_date < start_date:
        raise ProjectDatesOrderError()
    # The manager is resolved before any attribute changes: its query would
    # autoflush a duplicate code outside the commit that maps the clash.
    if "manager_email" in given and payload.manager_email is not None:
        project.manager_employee_id = get_or_create_employee(session, payload.manager_email).id
    for name in ("code", "name", "start_date", "end_date", "active"):
        if name in given:
            setattr(project, name, getattr(payload, name))
    _commit_project(session, project.code)
    session.refresh(project)
    logger.info("Project %s of team %s changed by %s", project.id, team_id, actor_email)
    return project


def delete_project(
    session: Session, team_id: uuid.UUID, project_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a project with its metrics, while none of them has a recorded value.

    Nor while one of them is a derivation's source. The database removes
    the metrics, their placements and threshold versions with it; RESTRICT
    on the values and the sources is the backstop behind the refusals here.
    """
    project = get_project(session, team_id, project_id)
    if _any_value(session, Metric.project_id == project.id):
        raise ProjectHasValuesError(project_id)
    _refuse_removing_a_source(session, Metric.project_id == project.id)
    session.delete(project)
    session.commit()
    logger.info("Project %s of team %s deleted by %s", project_id, team_id, actor_email)


def _commit_project(session: Session, code: str) -> None:
    """Commit, turning a clash on the company-wide code index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if PROJECT_CODE_UNIQUE_INDEX in str(error.orig):
            raise DuplicateProjectCodeError(code) from error
        raise


# --- Products -----------------------------------------------------------------


def list_products(session: Session, team_id: uuid.UUID) -> list[Product]:
    """The team's products, inactive ones included, ordered by name."""
    _require_team(session, team_id)
    statement = (
        select(Product)
        .where(Product.team_id == team_id)
        .order_by(func.lower(Product.name), Product.name)
    )
    return list(session.scalars(statement).unique())


def get_product(session: Session, team_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    """One product of the team; another team's is not found."""
    product = session.get(Product, product_id)
    if product is None or product.team_id != team_id:
        raise ProductNotFoundError(product_id)
    return product


def add_product(
    session: Session, team_id: uuid.UUID, payload: ProductCreate, actor_email: str
) -> Product:
    """Add an active product, recording its owner as an employee if they are new."""
    _require_team(session, team_id)
    owner = get_or_create_employee(session, payload.owner_email)
    product = Product(
        team_id=team_id,
        name=payload.name,
        owner_employee_id=owner.id,
        jira_url=payload.jira_url,
        active=True,
    )
    session.add(product)
    _commit_product(session, payload.name)
    session.refresh(product)
    logger.info("Product %s added to team %s by %s", product.id, team_id, actor_email)
    return product


def change_product(
    session: Session,
    team_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: ProductChange,
    actor_email: str,
) -> Product:
    """Change the properties a request names, its status included; `jira_url: null` clears it."""
    product = get_product(session, team_id, product_id)
    given = payload.model_fields_set
    # Resolved first for the same reason as a project's manager: a duplicate
    # name must reach the commit that maps it, not an autoflush before it.
    if "owner_email" in given and payload.owner_email is not None:
        product.owner_employee_id = get_or_create_employee(session, payload.owner_email).id
    for field in ("name", "jira_url", "active"):
        if field in given:
            setattr(product, field, getattr(payload, field))
    _commit_product(session, product.name)
    session.refresh(product)
    logger.info("Product %s of team %s changed by %s", product.id, team_id, actor_email)
    return product


def delete_product(
    session: Session, team_id: uuid.UUID, product_id: uuid.UUID, actor_email: str
) -> None:
    """Delete a product with its metrics, while none has a value or is a derivation's source."""
    product = get_product(session, team_id, product_id)
    if _any_value(session, Metric.product_id == product.id):
        raise ProductHasValuesError(product_id)
    _refuse_removing_a_source(session, Metric.product_id == product.id)
    session.delete(product)
    session.commit()
    logger.info("Product %s of team %s deleted by %s", product_id, team_id, actor_email)


def _commit_product(session: Session, name: str) -> None:
    """Commit, turning a clash on the team's product name index into its error."""
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if PRODUCT_NAME_UNIQUE_INDEX in str(error.orig):
            raise DuplicateProductNameError(name) from error
        raise
