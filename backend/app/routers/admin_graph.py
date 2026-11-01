"""Admin controls for the Neo4j read model: full rebuild and sync status."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db_session, require_admin
from app.graph import driver, sync

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_admin)])

STATUS_TIMEOUT_SECONDS = 5.0


class GraphRebuildResponse(BaseModel):
    nodes: dict[str, int]
    edges: dict[str, int]
    duration_ms: float


class GraphStatusResponse(BaseModel):
    enabled: bool
    reachable: bool
    outbox_pending: int
    outbox_failed: int
    nodes: dict[str, int] | None = None
    edges: dict[str, int] | None = None
    error: str | None = None


def _require_enabled() -> None:
    if not driver.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Neo4j is disabled (NEO4J_URI is not set); nothing to rebuild",
        )


@router.post("/rebuild", response_model=GraphRebuildResponse)
async def rebuild_graph(
    session: AsyncSession = Depends(get_db_session),
) -> GraphRebuildResponse:
    """Wipe Neo4j and rebuild it from Postgres."""
    _require_enabled()
    if await driver.ping() != "ok":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Neo4j is enabled but unreachable; rebuild not started",
        )
    try:
        result = await sync.full_rebuild(session)
    except Exception as exc:
        logger.exception("graph rebuild failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Graph rebuild failed: {exc}",
        ) from exc
    return GraphRebuildResponse(**result.as_dict())


@router.get("/status", response_model=GraphStatusResponse)
async def graph_status(
    session: AsyncSession = Depends(get_db_session),
) -> GraphStatusResponse:
    counts = await sync.outbox_counts(session)
    enabled = driver.is_enabled()
    reachable = False
    nodes = edges = None
    error = None
    if enabled:
        try:
            reachable = (
                await asyncio.wait_for(driver.ping(), timeout=STATUS_TIMEOUT_SECONDS) == "ok"
            )
            if reachable:
                graph = await asyncio.wait_for(sync.graph_counts(), timeout=STATUS_TIMEOUT_SECONDS)
                nodes, edges = graph["nodes"], graph["edges"]
            else:
                error = "Neo4j is unreachable"
        except Exception as exc:  # noqa: BLE001 - status reports, never fails
            reachable = False
            error = f"{type(exc).__name__}: {exc}"
    return GraphStatusResponse(
        enabled=enabled,
        reachable=reachable,
        outbox_pending=counts["pending"],
        outbox_failed=counts["failed"],
        nodes=nodes,
        edges=edges,
        error=error,
    )
