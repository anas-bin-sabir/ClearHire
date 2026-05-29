from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db import close_mongodb, close_neo4j, close_postgres, init_mongodb, init_neo4j, init_postgres
from app.db import mongodb as mongo_db
from app.db.neo4j_client import get_neo4j_driver
from app.db.repositories.neo4j import GraphRepository
from app.db.session import async_session_factory
from app.models.schemas import HealthResponse
from app.routers import fraud, freelancers, graph, projects, search, seed, stats, team_builder


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_postgres()
    await init_mongodb()
    try:
        await init_neo4j()
        graph_repo = GraphRepository()
        await graph_repo.ensure_constraints()
        await graph_repo.seed_skill_ontology()
    except Exception as exc:
        if settings.debug:
            print(f"Neo4j init warning (graph will use Postgres only): {exc}")
    yield
    await close_neo4j()
    await close_mongodb()
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

app.include_router(search.router, prefix="/search", tags=["Search"])
app.include_router(fraud.router, prefix="/fraud", tags=["Fraud"])
app.include_router(team_builder.router, prefix="/team-builder", tags=["Team Builder"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])
app.include_router(seed.router, prefix="/seed", tags=["Seed"])
app.include_router(freelancers.router, prefix="/freelancers", tags=["Freelancers"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(stats.router, prefix="/stats", tags=["Stats"])


@app.get("/")
async def root():
    return {
        "status": "ClearHire API running",
        "docs": "/docs",
        "endpoints": [
            "POST /search",
            "POST /fraud",
            "POST /team-builder",
            "GET /graph",
            "POST /seed",
            "GET /freelancers",
            "GET /projects",
            "GET /stats",
            "GET /health",
        ],
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    postgres_status = "ok"
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        postgres_status = f"error: {exc}"

    mongodb_status = "ok"
    try:
        await mongo_db.get_database().command("ping")
    except Exception as exc:
        mongodb_status = f"error: {exc}"

    neo4j_status = "ok"
    try:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run("RETURN 1")
    except Exception as exc:
        neo4j_status = f"error: {exc}"

    overall = (
        "ok"
        if all(s == "ok" for s in (postgres_status, mongodb_status))
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        postgres=postgres_status,
        mongodb=mongodb_status,
        neo4j=neo4j_status,
        anthropic_configured=bool(settings.anthropic_api_key),
    )
