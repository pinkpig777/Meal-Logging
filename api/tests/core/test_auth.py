import time

import jwt
import pytest

from app.core.auth import DEV_USER_ID, mint_dev_token, verify_token
from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode


def test_dev_token_round_trip() -> None:
    settings = get_settings()
    claims = verify_token(mint_dev_token(settings), settings)
    assert claims["sub"] == str(DEV_USER_ID)
    assert claims["aud"] == "authenticated"
    assert claims["role"] == "authenticated"
    assert claims["exp"] - claims["iat"] <= 600


def test_wrong_audience_and_expired_tokens_are_rejected() -> None:
    settings = get_settings()
    secret = settings.supabase_jwt_secret.get_secret_value()
    now = int(time.time())
    bad_aud = jwt.encode({"sub": "x", "aud": "anon", "exp": now + 60}, secret, algorithm="HS256")
    expired = jwt.encode(
        {"sub": "x", "aud": "authenticated", "exp": now - 60}, secret, algorithm="HS256"
    )
    wrong_key = jwt.encode(
        {"sub": "x", "aud": "authenticated", "exp": now + 60},
        "another-secret-with-at-least-32-characters!!",
        algorithm="HS256",
    )
    for token in (bad_aud, expired, wrong_key):
        with pytest.raises(AppError) as exc:
            verify_token(token, settings)
        assert exc.value.code == ErrorCode.UNAUTHENTICATED
