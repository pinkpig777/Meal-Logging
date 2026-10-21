"""Authentication: Supabase access token → `CurrentUser`.

- `AUTH_MODE=supabase`: verify the `Authorization: Bearer <jwt>` token (HS256, signed with
  `SUPABASE_JWT_SECRET`, audience "authenticated").
- `AUTH_MODE=dev` (only allowed with `APP_ENV=local`): any or no token is accepted and the
  request acts as the seeded dev user. A short-lived HS256 token is minted for that user, so
  database access still goes through RLS exactly like a real session.

Use it in routers as a parameter: `def handler(user: CurrentUser): ...`.
"""

import time
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import AppError, ErrorCode
from app.core.logging import set_user_id

DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
DEV_USER_EMAIL = "dev@example.com"
JWT_AUDIENCE = "authenticated"
DEV_TOKEN_TTL_SECONDS = 600

_bearer = HTTPBearer(auto_error=False, description="Supabase access token")


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None
    access_token: str
    claims: dict[str, Any]

    @property
    def avatar_url(self) -> str | None:
        meta = self.claims.get("user_metadata") or {}
        value = meta.get("avatar_url") or meta.get("picture")
        return value if isinstance(value, str) else None


def mint_dev_token(settings: Settings, *, now: int | None = None) -> str:
    """Mint a short-lived access token for the seeded dev user (dev auth mode only)."""
    issued = now if now is not None else int(time.time())
    claims = {
        "sub": str(DEV_USER_ID),
        "email": DEV_USER_EMAIL,
        "aud": JWT_AUDIENCE,
        "role": "authenticated",
        "iat": issued,
        "exp": issued + DEV_TOKEN_TTL_SECONDS,
        "user_metadata": {"full_name": "Dev User"},
    }
    return jwt.encode(claims, _jwt_secret(settings), algorithm="HS256")


def verify_token(token: str, settings: Settings) -> dict[str, Any]:
    # TODO(Yi-Wei): hosted projects using asymmetric signing keys need JWKS verification.
    try:
        claims = jwt.decode(
            token,
            _jwt_secret(settings),
            algorithms=["HS256"],
            audience=JWT_AUDIENCE,
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Your session is invalid or expired.") from exc
    return claims


def _jwt_secret(settings: Settings) -> str:
    secret = settings.supabase_jwt_secret.get_secret_value()
    if not secret:
        raise AppError(ErrorCode.INTERNAL, "Authentication is not configured on the server.")
    return secret


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthenticatedUser:
    if settings.auth_mode == "dev":
        token = mint_dev_token(settings)
        user = AuthenticatedUser(
            id=DEV_USER_ID,
            email=DEV_USER_EMAIL,
            access_token=token,
            claims=jwt.decode(token, options={"verify_signature": False}),
        )
    else:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise AppError(ErrorCode.UNAUTHENTICATED, "Sign in to continue.")
        claims = verify_token(credentials.credentials, settings)
        try:
            user_id = UUID(str(claims["sub"]))
        except ValueError as exc:
            raise AppError(ErrorCode.UNAUTHENTICATED) from exc
        user = AuthenticatedUser(
            id=user_id,
            email=claims.get("email"),
            access_token=credentials.credentials,
            claims=claims,
        )
    request.state.user_id = str(user.id)
    set_user_id(str(user.id))
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
