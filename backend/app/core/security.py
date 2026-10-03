"""Establishing who a request is from.

Two modes that never overlap. In broker mode a token must be RS256, signed by a
key the identity broker publishes; in dev mode it must be HS256, signed by a
secret this process generated and never wrote down. Because the accepted
algorithm is chosen by the mode and the sets are disjoint, a token minted in one
mode is rejected by the other before its key is ever consulted - which is what
makes dev mode unusable against a deployed server rather than merely discouraged.
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

from app.core.config import Mode, Settings, get_settings
from app.core.exceptions import ExpiredTokenError, MissingTokenError, UnauthenticatedError

logger = logging.getLogger(__name__)

#: The algorithm each mode accepts. Disjoint on purpose: see the module docstring.
ALGORITHMS: dict[Mode, list[str]] = {Mode.BROKER: ["RS256"], Mode.DEV: ["HS256"]}

#: The issuer dev-mode tokens claim. Not a URL, so it cannot collide with a broker.
DEV_ISSUER = "bmapp-dev"

#: How long a dev token lasts. Long enough for a sitting, short enough to expire.
DEV_TOKEN_LIFETIME = timedelta(hours=12)


@dataclass(frozen=True, slots=True)
class AuthenticatedPerson:
    """Who a verified token says is calling, before any lookup in the database."""

    email: str


@lru_cache
def _dev_secret() -> str:
    """The secret dev-mode tokens are signed with, generated once per process.

    Generated rather than configured so that no key exists to leak, be
    committed, or be reused by a second installation. Restarting the backend
    invalidates outstanding dev tokens, which in development means signing in
    again.
    """
    return secrets.token_urlsafe(32)


@lru_cache
def _jwk_client(issuer: str) -> PyJWKClient:
    """The broker's key set, cached and re-fetched when it names a key we lack.

    One client per issuer for the life of the process: it holds the cache, so
    building a new one per request would fetch the key set every time.
    """
    return PyJWKClient(f"{issuer.rstrip('/')}/.well-known/jwks.json", cache_keys=True)


def _signing_key(token: str, settings: Settings) -> Any:
    """The key the token must verify against, for the mode in force."""
    if settings.mode is Mode.DEV:
        return _dev_secret()
    try:
        return _jwk_client(settings.oidc_issuer).get_signing_key_from_jwt(token).key
    except Exception as error:
        # Covers an unknown key id and a key set that cannot be reached. Either
        # way the token cannot be verified, and the caller learns nothing about
        # which it was.
        raise UnauthenticatedError() from error


def _expected_issuer(settings: Settings) -> str:
    return DEV_ISSUER if settings.mode is Mode.DEV else settings.oidc_issuer


def verify_token(token: str, settings: Settings | None = None) -> AuthenticatedPerson:
    """Verify a token and return who it identifies, or raise.

    Every check is explicit. `algorithms` especially: accepting the algorithm
    the token itself names is the classic JWT forgery, and passing the set for
    the current mode is also what keeps the two modes apart.
    """
    settings = settings or get_settings()
    key = _signing_key(token, settings)
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS[settings.mode],
            issuer=_expected_issuer(settings),
            audience=settings.audience,
            options={"require": ["exp", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as error:
        raise ExpiredTokenError() from error
    except jwt.PyJWTError as error:
        # One refusal for a bad signature, a wrong issuer and a wrong audience
        # alike: telling them apart would tell an attacker which to fix.
        raise UnauthenticatedError() from error

    email = claims.get("email")
    if not isinstance(email, str) or not email.strip():
        raise UnauthenticatedError("The access token identifies nobody.")
    return AuthenticatedPerson(email=email.strip().lower())


def issue_dev_token(email: str, settings: Settings | None = None) -> str:
    """Mint a token for a test identity, in the shape a broker token has.

    The same claims the real one carries, so every rule built on identity is
    exercised by the same code path in development as in production.
    """
    settings = settings or get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "email": email,
            "iss": DEV_ISSUER,
            "aud": settings.audience,
            "iat": now,
            "exp": now + DEV_TOKEN_LIFETIME,
        },
        _dev_secret(),
        algorithm=ALGORITHMS[Mode.DEV][0],
    )


def token_from_header(authorization: str | None) -> str:
    """The bearer token out of an Authorization header, or raise."""
    if not authorization:
        raise MissingTokenError()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise MissingTokenError()
    return token.strip()
