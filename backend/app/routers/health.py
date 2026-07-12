from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    postgres_status = "ok"
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        postgres_status = "error"

    overall = "ok" if postgres_status == "ok" else "degraded"
    return HealthResponse(
        status=overall,
        postgres=postgres_status,
        anthropic_configured=bool(settings.anthropic_api_key),
    )
