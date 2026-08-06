"""In-memory rate limiting.

Three tiers, all threshold-configurable via `Settings` (env vars), never
hardcoded in the checking logic itself:

- ``public``   — moderate limits for anonymous/read-heavy endpoints
                 (search, graph, stats, list views, ...).
- ``user``     — looser limits for authenticated-user actions (creating/
                 updating freelancers, projects, contracts, team builds, ...).
- ``auth``     — strict limits for /auth/login and /auth/signup, keyed by
                 *both* client IP and account identifier (email), using
                 exponential backoff per key instead of a hard lockout: each
                 failed attempt increases the wait before the next attempt is
                 allowed, capped at a configurable maximum, and resets on a
                 successful attempt.

This implementation keeps all counters in local process memory behind an
``asyncio.Lock``. That is sufficient for a single-process deployment; if the
API ever runs as multiple workers/instances, back this with a shared store
(e.g. Redis) instead so limits are enforced consistently across processes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, status

from app.core.config import settings


def _client_ip(request: Request) -> str:
    # Trust X-Forwarded-For only as a hint; falls back to the direct peer.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _too_many_requests(retry_after_seconds: float) -> HTTPException:
    retry_after = max(1, int(retry_after_seconds + 0.999))
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please slow down and try again shortly.",
        headers={"Retry-After": str(retry_after)},
    )


# --- Fixed-window limiter (public / user-action tiers) ---


@dataclass
class _Window:
    count: int = 0
    reset_at: float = 0.0


class FixedWindowRateLimiter:
    """Simple per-key fixed-window counter used for the `public` and `user`
    tiers, where the goal is a straightforward request cap rather than
    brute-force protection."""

    def __init__(self) -> None:
        self._windows: dict[str, _Window] = {}

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        if max_requests <= 0:
            return  # 0/negative disables the limit for this tier

        now = time.monotonic()
        window = self._windows.get(key)

        if window is None or now >= window.reset_at:
            window = _Window(count=0, reset_at=now + window_seconds)
            self._windows[key] = window

        window.count += 1
        if window.count > max_requests:
            raise _too_many_requests(window.reset_at - now)


# --- Auth tier: per-IP + per-account exponential backoff ---


@dataclass
class _BackoffState:
    failures: int = 0
    next_allowed_at: float = 0.0


class AuthBackoffLimiter:
    """Combines a per-IP and a per-account backoff state. Neither key is
    ever permanently locked: each failed attempt on a key increases the
    delay before that key may try again (exponential, capped), and a
    successful attempt clears it back to zero."""

    def __init__(self) -> None:
        self._state: dict[str, _BackoffState] = {}

    def _delay_for(self, failures: int) -> float:
        if failures <= settings.rate_limit_auth_free_attempts:
            return 0.0
        exponent = failures - settings.rate_limit_auth_free_attempts - 1
        delay = settings.rate_limit_auth_backoff_base_seconds * (
            settings.rate_limit_auth_backoff_multiplier**exponent
        )
        return min(delay, settings.rate_limit_auth_backoff_max_seconds)

    def check(self, *keys: str) -> None:
        """Raise 429 if any of the given keys (e.g. `ip:1.2.3.4`,
        `acct:user@example.com`) is currently backed off."""
        if not settings.rate_limit_enabled:
            return
        now = time.monotonic()
        for key in keys:
            state = self._state.get(key)
            if state and now < state.next_allowed_at:
                raise _too_many_requests(state.next_allowed_at - now)

    def record_failure(self, *keys: str) -> None:
        if not settings.rate_limit_enabled:
            return
        now = time.monotonic()
        for key in keys:
            state = self._state.setdefault(key, _BackoffState())
            state.failures += 1
            state.next_allowed_at = now + self._delay_for(state.failures)

    def record_success(self, *keys: str) -> None:
        for key in keys:
            self._state.pop(key, None)


public_limiter = FixedWindowRateLimiter()
user_action_limiter = FixedWindowRateLimiter()
auth_limiter = AuthBackoffLimiter()


def enforce_public_rate_limit(request: Request) -> None:
    if not settings.rate_limit_enabled:
        return
    key = f"{request.url.path}:{_client_ip(request)}"
    public_limiter.check(
        key,
        settings.rate_limit_public_max_requests,
        settings.rate_limit_public_window_seconds,
    )


def enforce_user_action_rate_limit(request: Request) -> None:
    if not settings.rate_limit_enabled:
        return
    key = f"{request.url.path}:{_client_ip(request)}"
    user_action_limiter.check(
        key,
        settings.rate_limit_user_max_requests,
        settings.rate_limit_user_window_seconds,
    )


def auth_keys(request: Request, account_identifier: str) -> tuple[str, str]:
    ip_key = f"ip:{_client_ip(request)}"
    acct_key = f"acct:{account_identifier.strip().lower()}"
    return ip_key, acct_key


def enforce_auth_rate_limit(request: Request, account_identifier: str) -> None:
    """Call at the top of a login/signup handler before doing any real
    work (password hashing/DB lookups) so a backed-off caller pays no cost
    beyond the check itself."""
    ip_key, acct_key = auth_keys(request, account_identifier)
    auth_limiter.check(ip_key, acct_key)


def record_auth_failure(request: Request, account_identifier: str) -> None:
    ip_key, acct_key = auth_keys(request, account_identifier)
    auth_limiter.record_failure(ip_key, acct_key)


def record_auth_success(request: Request, account_identifier: str) -> None:
    ip_key, acct_key = auth_keys(request, account_identifier)
    auth_limiter.record_success(ip_key, acct_key)
