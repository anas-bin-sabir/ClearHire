from typing import Any, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db.repositories.postgres import ActivityLogRepository
from app.db.session import async_session_factory

_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "authorization",
    "api_key",
    "anthropic_api_key",
    "gemini_api_key",
    "jwt",
}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if str(key).lower() in _SENSITIVE_KEYS:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = _redact(item)
        return cleaned
    if isinstance(value, list):
        return [_redact(item) for item in value[:50]]
    if isinstance(value, str) and len(value) > 2000:
        return value[:2000] + "…"
    return value


async def log_activity(
    endpoint: str,
    method: str,
    payload: Optional[dict[str, Any]] = None,
    response_summary: Optional[dict[str, Any]] = None,
    status: str = "success",
    error: Optional[str] = None,
    repo: ActivityLogRepository | None = None,
) -> str | None:
    try:
        safe_payload = _redact(payload or {})
        safe_summary = _redact(response_summary or {})
        if repo:
            return await repo.insert(
                endpoint=endpoint,
                method=method,
                payload=safe_payload,
                response_summary=safe_summary,
                status=status,
                error=error,
            )
        async with async_session_factory() as session:
            repository = ActivityLogRepository(session)
            result = await repository.insert(
                endpoint=endpoint,
                method=method,
                payload=safe_payload,
                response_summary=safe_summary,
                status=status,
                error=error,
            )
            await session.commit()
            return result
    except Exception:
        return None


class ActivityLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path in {"/health", "/docs", "/openapi.json", "/redoc"}:
            return response
        try:
            status_label = "success" if response.status_code < 400 else "error"
            await log_activity(
                endpoint=path,
                method=request.method,
                payload={"query": dict(request.query_params)},
                response_summary={"status_code": response.status_code},
                status=status_label,
                error=None if response.status_code < 400 else f"HTTP {response.status_code}",
            )
        except Exception:
            pass
        return response
