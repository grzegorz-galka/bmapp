"""A team's products. Validate input, decide who may write, delegate, and return."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUserDependency
from app.api.projects import require_board_configurer
from app.core.db import get_session
from app.schemas.project import ProductChange, ProductCreate, ProductRead
from app.services.projects import (
    add_product,
    change_product,
    delete_product,
    get_product,
    list_products,
)

router = APIRouter(prefix="/teams/{team_id}/products", tags=["products"])

SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[ProductRead])
def get_products(
    team_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> list[ProductRead]:
    """Return the team's products ordered by name, inactive ones included and marked."""
    return [ProductRead.model_validate(product) for product in list_products(session, team_id)]


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    team_id: uuid.UUID,
    payload: ProductCreate,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProductRead:
    """Add an active product to the team."""
    require_board_configurer(session, current_user, team_id)
    return ProductRead.model_validate(add_product(session, team_id, payload, current_user.email))


@router.get("/{product_id}", response_model=ProductRead)
def read_product(
    team_id: uuid.UUID, product_id: uuid.UUID, session: SessionDependency, _: CurrentUserDependency
) -> ProductRead:
    """Return one product of the team."""
    return ProductRead.model_validate(get_product(session, team_id, product_id))


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    team_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: ProductChange,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> ProductRead:
    """Change any property of a product, its status included."""
    require_board_configurer(session, current_user, team_id)
    product = change_product(session, team_id, product_id, payload, current_user.email)
    return ProductRead.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_product(
    team_id: uuid.UUID,
    product_id: uuid.UUID,
    session: SessionDependency,
    current_user: CurrentUserDependency,
) -> Response:
    """Delete a product with its metrics, while none of them has a recorded value."""
    require_board_configurer(session, current_user, team_id)
    delete_product(session, team_id, product_id, current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
