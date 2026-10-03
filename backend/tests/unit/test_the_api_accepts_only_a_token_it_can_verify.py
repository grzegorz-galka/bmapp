"""Requirement: The API accepts only a token it can verify.

RSA keys are generated in the test rather than fetched, so the broker-mode
path is exercised without a network: the key set is substituted, which is the
one thing a unit test cannot reach for.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import Mode, Settings
from app.core.exceptions import ExpiredTokenError, MissingTokenError, UnauthenticatedError
from app.core.security import DEV_ISSUER, token_from_header, verify_token

ISSUER = "https://identity.intra.pse.pl"
AUDIENCE = "bmapp"

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def broker_settings(**overrides: Any) -> Settings:
    return Settings(mode=Mode.BROKER, oidc_issuer=ISSUER, oidc_client_id=AUDIENCE, **overrides)


def make_token(
    *,
    key: Any = _PRIVATE_KEY,
    algorithm: str = "RS256",
    issuer: str = ISSUER,
    audience: str = AUDIENCE,
    email: str | None = "jan.kowalski@pse.pl",
    expires_in: timedelta = timedelta(minutes=30),
) -> str:
    now = datetime.now(UTC)
    claims: dict[str, Any] = {"iss": issuer, "aud": audience, "iat": now, "exp": now + expires_in}
    if email is not None:
        claims["email"] = email
    return jwt.encode(claims, key, algorithm=algorithm)


@pytest.fixture(autouse=True)
def _use_the_generated_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Substitute the broker's key set with the public key generated above."""
    monkeypatch.setattr(
        "app.core.security._signing_key",
        lambda token, settings: (
            _PRIVATE_KEY.public_key() if settings.mode is Mode.BROKER else "unused"
        ),
    )


def test_a_valid_token_is_accepted() -> None:
    person = verify_token(make_token(), broker_settings())
    assert person.email == "jan.kowalski@pse.pl"


def test_the_email_is_lower_cased_to_match_a_recorded_employee() -> None:
    person = verify_token(make_token(email="Jan.Kowalski@PSE.pl"), broker_settings())
    assert person.email == "jan.kowalski@pse.pl"


def test_the_token_has_expired() -> None:
    with pytest.raises(ExpiredTokenError) as refusal:
        verify_token(make_token(expires_in=timedelta(minutes=-1)), broker_settings())
    assert refusal.value.code == "auth.token_expired"


def test_the_signature_does_not_verify() -> None:
    """Signed by a key the broker does not publish."""
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(make_token(key=_OTHER_PRIVATE_KEY), broker_settings())
    assert refusal.value.code == "auth.token_invalid"


def test_the_token_was_minted_for_another_application() -> None:
    """Verifies and is current, but names someone else's audience."""
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(make_token(audience="some-other-app"), broker_settings())
    assert refusal.value.code == "auth.token_invalid"


def test_the_token_was_issued_by_another_broker() -> None:
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(make_token(issuer="https://identity.example.com"), broker_settings())
    assert refusal.value.code == "auth.token_invalid"


def test_the_token_carries_no_email() -> None:
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(make_token(email=None), broker_settings())
    assert refusal.value.code == "auth.token_invalid"


@pytest.mark.parametrize("email", ["", "   "])
def test_the_token_carries_a_blank_email(email: str) -> None:
    with pytest.raises(UnauthenticatedError):
        verify_token(make_token(email=email), broker_settings())


def test_a_token_missing_its_expiry_is_refused() -> None:
    """`exp` is required rather than optional: a token without one never dies."""
    now = datetime.now(UTC)
    token = jwt.encode(
        {"iss": ISSUER, "aud": AUDIENCE, "iat": now, "email": "a@pse.pl"},
        _PRIVATE_KEY,
        algorithm="RS256",
    )
    with pytest.raises(UnauthenticatedError):
        verify_token(token, broker_settings())


def test_broker_mode_rejects_a_dev_signed_token_on_its_algorithm() -> None:
    """The guarantee that a development token cannot work against a deployed server.

    Signed HS256 with a secret, which broker mode never accepts whatever the
    secret is, because the algorithm set for the mode does not contain it.
    """
    token = make_token(key="a-shared-secret-long-enough-for-sha256!", algorithm="HS256")
    with pytest.raises(UnauthenticatedError) as refusal:
        verify_token(token, broker_settings())
    assert refusal.value.code == "auth.token_invalid"


def test_the_configured_audience_overrides_the_client_id() -> None:
    settings = broker_settings(oidc_audience="https://api.bmapp")
    person = verify_token(make_token(audience="https://api.bmapp"), settings)
    assert person.email == "jan.kowalski@pse.pl"
    with pytest.raises(UnauthenticatedError):
        verify_token(make_token(audience=AUDIENCE), settings)


def test_the_two_modes_accept_no_algorithm_in_common() -> None:
    """The property every other separation in this module rests on."""
    from app.core.security import ALGORITHMS

    assert not set(ALGORITHMS[Mode.BROKER]) & set(ALGORITHMS[Mode.DEV])


def test_the_dev_issuer_is_not_a_url_so_it_cannot_collide_with_a_broker() -> None:
    assert "://" not in DEV_ISSUER


@pytest.mark.parametrize(
    "header", [None, "", "Bearer", "Bearer   ", "Basic abc", "token abc", "abc"]
)
def test_a_request_presents_no_usable_bearer_token(header: str | None) -> None:
    with pytest.raises(MissingTokenError) as refusal:
        token_from_header(header)
    assert refusal.value.code == "auth.token_missing"


@pytest.mark.parametrize("header", ["Bearer abc.def.ghi", "bearer abc.def.ghi"])
def test_a_bearer_token_is_read_from_the_header(header: str) -> None:
    assert token_from_header(header) == "abc.def.ghi"
