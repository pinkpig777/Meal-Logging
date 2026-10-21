"""Supabase client factories.

- `UserDb` (per request): authorized with the caller's JWT, so Postgres RLS and Storage RLS
  apply. **Use this for everything a user does.**
- `get_admin_client()`: uses the service-role key and BYPASSES RLS. ADMIN TASKS ONLY
  (storage cleanup, account purge). Never use it to serve a normal user request.
"""

from typing import Annotated

from fastapi import Depends
from supabase import Client, ClientOptions, create_client
from supabase_auth._sync.storage import SyncMemoryStorage

from app.core.auth import CurrentUser
from app.core.config import Settings, get_settings
from app.core.errors import AppError, ErrorCode


def create_user_client(access_token: str, settings: Settings) -> Client:
    anon_key = settings.supabase_anon_key.get_secret_value()
    if not anon_key:
        raise AppError(ErrorCode.INTERNAL, "The database is not configured on the server.")
    options = ClientOptions(
        headers={"Authorization": f"Bearer {access_token}"},
        auto_refresh_token=False,
        persist_session=False,
        storage=SyncMemoryStorage(),
        postgrest_client_timeout=15,
    )
    return create_client(settings.supabase_url, anon_key, options=options)


def get_user_client(
    user: CurrentUser, settings: Annotated[Settings, Depends(get_settings)]
) -> Client:
    return create_user_client(user.access_token, settings)


UserDb = Annotated[Client, Depends(get_user_client)]


def get_admin_client(settings: Settings | None = None) -> Client:
    """ADMIN ONLY: a client with the service-role key. Bypasses RLS.

    Allowed uses (data-model §9): purging a deleted account's storage folder, scheduled
    cleanup jobs. Do not inject this into request handlers that act on behalf of a user.
    """
    settings = settings or get_settings()
    key = settings.supabase_service_role_key.get_secret_value()
    if not key:
        raise AppError(ErrorCode.INTERNAL, "The admin database client is not configured.")
    options = ClientOptions(
        auto_refresh_token=False, persist_session=False, storage=SyncMemoryStorage()
    )
    return create_client(settings.supabase_url, key, options=options)
