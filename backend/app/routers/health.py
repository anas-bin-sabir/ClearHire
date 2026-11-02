import asyncio

from fastapi import APIRouter
from sqlalchemy import text

from app.ai import llm
from app.core.config import settings
from app.db.session import async_session_factory
from app.graph import driver as graph_driver
from app.models.schemas import HealthResponse

router = APIRouter()

NEO4J_PING_TIMEOUT_SECONDS = 3.0


async def _neo4j_status() -> str:
    if not graph_driver.is_enabled():
        return "disabled"
    try:
        return await asyncio.wait_for(graph_driver.ping(), timeout=NEO4J_PING_TIMEOUT_SECONDS)
    except Exception:  # noqa: BLE001 - health reports, never raises
        return "error"


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    postgres_status = "ok"
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        postgres_status = "error"

    neo4j_status = await _neo4j_status()
    # Neo4j is optional: "disabled" is healthy, enabled-but-failing is degraded.
    healthy = postgres_status == "ok" and neo4j_status != "error"
    return HealthResponse(
        status="ok" if healthy else "degraded",
        postgres=postgres_status,
        neo4j=neo4j_status,
        anthropic_configured=llm.is_configured(),
        llm_provider=llm.provider() if llm.is_configured() else None,
        auth_provider="supabase" if settings.uses_supabase_auth else "local",
    )
