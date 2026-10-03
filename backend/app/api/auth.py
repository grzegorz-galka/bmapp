"""Identity endpoints: who the caller is, and - in development - how to become one."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUserDependency
from app.core.config import Mode, get_settings
from app.core.security import issue_dev_token
from app.schemas.auth import CurrentUserRead, DevLogin, DevToken

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUserRead, summary="The signed-in person")
def read_current_user(current_user: CurrentUserDependency) -> CurrentUserRead:
    """Return the caller's email and whether they are an administrator.

    Its own endpoint rather than part of the hub summary: the hub is
    placeholder data due to be replaced slice by slice, and every page needs
    the administrator flag, which nothing else in any payload reveals.
    """
    return CurrentUserRead(email=current_user.email, is_admin=current_user.is_admin)


def _register_dev_login(router: APIRouter) -> None:
    """Add the local login endpoint. Called only when the mode is dev.

    Registered conditionally rather than guarded inside the handler, so that
    in broker mode the route does not exist at all - there is no code path to
    reach, and the OpenAPI document does not advertise one.
    """

    @router.post(
        "/dev-login",
        response_model=DevToken,
        status_code=status.HTTP_200_OK,
        summary="Obtain a local token (development mode only)",
        description=(
            "Mints a token for a test identity without the identity broker. This "
            "route exists only while BMAPP_MODE=dev, and the token it returns is "
            "signed with an algorithm a broker-mode server never accepts."
        ),
    )
    def dev_login(payload: DevLogin) -> DevToken:
        return DevToken(access_token=issue_dev_token(payload.email))


if get_settings().mode is Mode.DEV:
    _register_dev_login(router)
