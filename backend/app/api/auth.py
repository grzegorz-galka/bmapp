"""Identity endpoints: who the caller is, and - in development - how to become one."""

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUserDependency, SessionDependency
from app.core.config import Mode, get_settings
from app.core.security import issue_dev_token
from app.schemas.auth import (
    CurrentUserRead,
    DevLogin,
    DevPasswordChangeRequired,
    DevPasswordSet,
    DevToken,
)
from app.services.current_user import identify
from app.services.dev_login import authenticate_dev_login, set_dev_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUserRead, summary="The signed-in person")
def read_current_user(
    current_user: CurrentUserDependency, session: SessionDependency
) -> CurrentUserRead:
    """Return the caller's email, administrator flag, name and display name.

    Its own endpoint rather than part of the dashboard summary: every page
    needs the administrator flag, not only the dashboard, and nothing else in
    any payload reveals it. It is also where the broker's name claims are kept
    on the employee, because the header reads it after every sign-in.
    """
    identity = identify(
        session,
        current_user.email,
        current_user.is_admin,
        current_user.employee,
        current_user.given_name,
        current_user.family_name,
    )
    return CurrentUserRead(
        email=identity.email,
        is_admin=identity.is_admin,
        name=identity.name,
        surname=identity.surname,
        display_name=identity.display_name,
        initials=identity.initials,
    )


def _register_dev_login(router: APIRouter) -> None:
    """Add the local sign-in endpoints. Called only when the mode is dev.

    Registered conditionally rather than guarded inside the handler, so that
    in broker mode the routes do not exist at all - there is no code path to
    reach, and the OpenAPI document does not advertise one.
    """

    @router.post(
        "/dev-login",
        response_model=DevToken | DevPasswordChangeRequired,
        status_code=status.HTTP_200_OK,
        summary="Obtain a local token (development mode only)",
        description=(
            "Mints a token for a recorded employee or an administrator without the "
            "identity broker, for the password they have chosen. Until they choose "
            "one, the password derived from the email is accepted but issues no "
            "token: the answer says a new password must be chosen and proposes a "
            "name and surname. This route exists only while BMAPP_MODE=dev, and "
            "the token it returns is signed with an algorithm a broker-mode server "
            "never accepts."
        ),
    )
    def dev_login(
        payload: DevLogin, session: SessionDependency
    ) -> DevToken | DevPasswordChangeRequired:
        result = authenticate_dev_login(
            session, payload.email, payload.password, get_settings().admin_emails
        )
        if result.password_change_required:
            return DevPasswordChangeRequired(name=result.name, surname=result.surname)
        return DevToken(access_token=issue_dev_token(result.email))

    @router.post(
        "/dev-password",
        response_model=DevToken,
        status_code=status.HTTP_200_OK,
        summary="Choose a development password (development mode only)",
        description=(
            "Stores a new password for the email, given its current one, and the "
            "name and surname of a recorded employee, then returns a token. This "
            "route exists only while BMAPP_MODE=dev."
        ),
    )
    def dev_password(payload: DevPasswordSet, session: SessionDependency) -> DevToken:
        email = set_dev_password(
            session,
            payload.email,
            payload.current_password,
            payload.new_password,
            payload.name,
            payload.surname,
            get_settings().admin_emails,
        )
        return DevToken(access_token=issue_dev_token(email))


if get_settings().mode is Mode.DEV:
    _register_dev_login(router)
