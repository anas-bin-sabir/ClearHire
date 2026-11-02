import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.ai.embeddings import warm_up
from app.core import supabase_auth
from app.core.config import settings
from app.db import close_postgres, init_postgres
from app.db.repositories.postgres import SkillRepository
from app.db.session import async_session_factory
from app.graph import driver as graph_driver
from app.graph import outbox as graph_outbox
from app.graph import sync as graph_sync
from app.routers import (
    activity,
    admin_graph,
    analytics,
    auth,
    contracts,
    fraud,
    freelancers,
    graph,
    health,
    projects,
    search,
    seed,
    settings as settings_router,
    stats,
    team_builder,
)


logger = logging.getLogger(__name__)


async def _start_graph() -> None:
    """Constraints + skill ontology + outbox drainer. Never fails startup."""
    if not graph_driver.is_enabled():
        return
    try:
        # Ping first: the driver retries failed queries for ~30s, which would stall boot.
        if await asyncio.wait_for(graph_driver.ping(), timeout=5.0) == "ok":
            await graph_sync.apply_constraints()
            async with async_session_factory() as session:
                await graph_sync.sync_skill_ontology(session)
        else:
            logger.warning("Neo4j unreachable at startup; the outbox drainer will sync the ontology")
            async with async_session_factory() as session:
                await graph_outbox.enqueue(session, "skill_relationships", 0)
                await session.commit()
    except Exception as exc:  # noqa: BLE001 - Neo4j is optional
        logger.warning("Neo4j unavailable at startup (graph sync will retry): %s", exc)
    graph_sync.start_drainer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_postgres()
    await asyncio.to_thread(warm_up)
    async with async_session_factory() as session:
        await SkillRepository(session).sync_taxonomy()
        await session.commit()
    await _start_graph()
    try:
        yield
    finally:
        await graph_sync.stop_drainer()
        await graph_driver.close_driver()
        await supabase_auth.close_client()
        await close_postgres()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(search.router, prefix="/search", tags=["Search"])
app.include_router(fraud.router, prefix="/fraud", tags=["Fraud"])
app.include_router(team_builder.router, prefix="/team-builder", tags=["Team Builder"])
app.include_router(seed.router, prefix="/seed", tags=["Seed"])
app.include_router(freelancers.router, prefix="/freelancers", tags=["Freelancers"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(contracts.router, prefix="/contracts", tags=["Contracts"])
app.include_router(settings_router.router, prefix="/settings", tags=["Settings"])
app.include_router(stats.router, prefix="/stats", tags=["Stats"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(activity.router, prefix="/activity", tags=["Activity"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])
app.include_router(admin_graph.router, prefix="/admin/graph", tags=["Admin Graph"])
app.include_router(health.router, tags=["Health"])


@app.get("/", include_in_schema=False)
async def root():
    endpoints = sorted(
        f"{method} {route.path}"
        for route in app.routes
        if isinstance(route, APIRoute) and route.include_in_schema
        for method in route.methods
    )
    return {"status": "ClearHire API running", "docs": "/docs", "endpoints": endpoints}
