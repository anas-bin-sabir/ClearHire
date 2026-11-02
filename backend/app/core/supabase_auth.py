"""Supabase Auth (GoTrue) client: sign-in, refresh, server-side user creation and
access-token verification.

Supabase owns passwords. The API keeps its own ``users`` row per account (role,
name, foreign keys) linked through ``users.auth_user_id`` = ``auth.users.id``.
Roles always come from that row, never from token claims.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

AUDIENCE = "authenticated"
JWKS_TTL_SECONDS = 600.0
# Minimum gap between JWKS refetches triggered by an unknown key id.
JWKS_REFETCH_COOLDOWN_SECONDS = 60.0

_http: httpx.AsyncClient | None = None
_jwks: dict[str, Any] | None = None
_jwks_fetched_at = 0.0


class SupabaseAuthError(Exception):
    """Supabase rejected the request. ``code`` is GoTrue's error_code when present."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class SupabaseUnavailable(Exception):
    """Supabase Auth couldn't be reached or isn't configured."""


@dataclass
class AuthSession:
    auth_user_id: str
    email: str
    access_token: str
    refresh_token: str
    expires_in: int
    app_metadata: dict[str, Any]
    user_metadata: dict[str, Any]


def _base() -> str:
    if not settings.supabase_url:
        raise SupabaseUnavailable("SUPABASE_URL is not set")
    return settings.supabase_url.rstrip("/") + "/auth/v1"


def issuer() -> str:
    return _base()


def _client() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=settings.supabase_timeout_seconds)
    return _http


async def close_client() -> None:
    global _http
    if _http is not None:
        await _http.aclose()
        _http = None


def _headers(key: str) -> dict[str, str]:
    if not key:
        raise SupabaseUnavailable("Supabase API key is not set")
    # Same pair supabase-js sends; works for legacy JWT keys and sb_* keys.
    return {"apikey": key, "Authorization": f"Bearer {key}"}


async def _request(method: str, path: str, *, key: str, json: dict | None = None) -> dict:
    try:
        response = await _client().request(
            method, _base() + path, headers=_headers(key), json=json
        )
    except httpx.HTTPError as exc:
        logger.warning("supabase auth %s %s failed: %s", method, path.split("?")[0], exc)
        raise SupabaseUnavailable(str(exc)) from exc
    if response.status_code >= 500:
        logger.warning("supabase auth %s %s returned %s", method, path.split("?")[0], response.status_code)
        raise SupabaseUnavailable(f"Supabase Auth returned {response.status_code}")
    data: dict = {}
    if response.content:
        try:
            data = response.json()
        except ValueError:
            data = {}
    if response.status_code >= 400:
        code = str(data.get("error_code") or data.get("error") or data.get("code") or "")
        message = str(
            data.get("msg") or data.get("message") or data.get("error_description") or "auth error"
        )
        raise SupabaseAuthError(response.status_code, code, message)
    return data


def _session(data: dict) -> AuthSession:
    user = data.get("user") or {}
    return AuthSession(
        auth_user_id=str(user.get("id", "")),
        email=str(user.get("email", "")),
        access_token=str(data["access_token"]),
        refresh_token=str(data.get("refresh_token", "")),
        expires_in=int(data.get("expires_in") or 3600),
        app_metadata=dict(user.get("app_metadata") or {}),
        user_metadata=dict(user.get("user_metadata") or {}),
    )


async def sign_in_with_password(email: str, password: str) -> AuthSession:
    data = await _request(
        "POST",
        "/token?grant_type=password",
        key=settings.supabase_anon_key,
        json={"email": email, "password": password},
    )
    return _session(data)


async def refresh_session(refresh_token: str) -> AuthSession:
    data = await _request(
        "POST",
        "/token?grant_type=refresh_token",
        key=settings.supabase_anon_key,
        json={"refresh_token": refresh_token},
    )
    return _session(data)


async def admin_create_user(*, email: str, password: str, name: str, role: str) -> str:
    """Create a confirmed user (no confirmation email) and return its auth id."""
    data = await _request(
        "POST",
        "/admin/users",
        key=settings.supabase_service_role_key,
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": name},
            # app_metadata is writable only with the secret key, so it's safe for role.
            "app_metadata": {"role": role},
        },
    )
    user = data.get("user", data)
    return str(user["id"])


async def admin_delete_user(auth_user_id: str) -> None:
    await _request(
        "DELETE", f"/admin/users/{auth_user_id}", key=settings.supabase_service_role_key
    )


async def _get_jwks(force: bool = False) -> dict[str, Any]:
    global _jwks, _jwks_fetched_at
    now = time.monotonic()
    stale = now - _jwks_fetched_at > JWKS_TTL_SECONDS
    cooled = now - _jwks_fetched_at > JWKS_REFETCH_COOLDOWN_SECONDS
    if _jwks is None or stale or (force and cooled):
        try:
            response = await _client().get(_base() + "/.well-known/jwks.json")
            response.raise_for_status()
            _jwks = response.json()
            _jwks_fetched_at = now
        except (httpx.HTTPError, ValueError) as exc:
            if _jwks is None:
                raise SupabaseUnavailable(f"JWKS unavailable: {exc}") from exc
            logger.warning("JWKS refresh failed; using cached keys: %s", exc)
    return _jwks or {"keys": []}


def _find_key(jwks: dict[str, Any], kid: str | None) -> dict[str, Any] | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def verify_access_token(token: str) -> dict[str, Any]:
    """Return the claims of a valid Supabase access token; raise JWTError otherwise."""
    header = jwt.get_unverified_header(token)
    alg = header.get("alg")
    options = {"verify_aud": True, "verify_iss": True}
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise JWTError("HS256 token but SUPABASE_JWT_SECRET is not set")
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=issuer(),
            options=options,
        )
    if alg not in ("ES256", "RS256"):
        raise JWTError(f"unsupported algorithm {alg!r}")
    kid = header.get("kid")
    key = _find_key(await _get_jwks(), kid)
    if key is None:
        key = _find_key(await _get_jwks(force=True), kid)
    if key is None:
        raise JWTError("unknown signing key")
    return jwt.decode(
        token, key, algorithms=[alg], audience=AUDIENCE, issuer=issuer(), options=options
    )
