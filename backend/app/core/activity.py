from typing import Any, Optional

from app.db.repositories.mongo import ActivityLogRepository


async def log_activity(
    endpoint: str,
    method: str,
    payload: Optional[dict[str, Any]] = None,
    response_summary: Optional[dict[str, Any]] = None,
    status: str = "success",
    error: Optional[str] = None,
    repo: ActivityLogRepository | None = None,
) -> str:
    repository = repo or ActivityLogRepository()
    return await repository.insert(
        endpoint=endpoint,
        method=method,
        payload=payload,
        response_summary=response_summary,
        status=status,
        error=error,
    )
