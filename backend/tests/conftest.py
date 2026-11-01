"""Test harness: real PostgreSQL + pgvector, hash embeddings, no LLM calls.

Point TEST_DATABASE_URL at a disposable database; its public schema is dropped
and rebuilt through the Alembic migrations once per session.
"""

import asyncio
import os

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://clearhire:clearhire123@localhost:5436/clearhire_test",
)
# Must be set before any app module reads settings.
os.environ.update(
    {
        "DATABASE_URL": TEST_DATABASE_URL,
        "EMBEDDING_PROVIDER": "hash",
        "DB_NULL_POOL": "true",
        "RATE_LIMIT_ENABLED": "false",
        "ANTHROPIC_API_KEY": "",
        # Never call a real LLM from tests, even if backend/.env has a key.
        "GEMINI_API_KEY": "",
        "LLM_PROVIDER": "auto",
        "SECRET_KEY": "test-secret",
        "AUTO_MIGRATE": "true",
        # Graph tests opt in to Neo4j via the neo4j_graph fixture; the rest of the
        # suite runs with it disabled (Postgres fallback).
        "NEO4J_URI": "",
    }
)
TEST_NEO4J_URI = os.environ.get("TEST_NEO4J_URI", "bolt://localhost:7688")
TEST_NEO4J_PASSWORD = os.environ.get("TEST_NEO4J_PASSWORD", "clearhire123")

import httpx  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.security import create_access_token, get_password_hash  # noqa: E402
from app.db.repositories.postgres import (  # noqa: E402
    FreelancerRepository,
    ProjectRepository,
    SkillRepository,
    UserRepository,
)
from app.db.session import async_session_factory, engine, init_postgres  # noqa: E402
from app.main import app  # noqa: E402

TABLES = (
    "contracts",
    "projects",
    "freelancers",
    "user_settings",
    "users",
    "activity_logs",
    "ai_explanations",
    "graph_outbox",
)


async def _rebuild_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await init_postgres()
    # Reference data, synced once like app startup does (not truncated per test).
    async with async_session_factory() as session:
        await SkillRepository(session).sync_taxonomy()
        await session.commit()


@pytest.fixture(scope="session", autouse=True)
def _schema():
    asyncio.run(_rebuild_schema())


@pytest.fixture(autouse=True)
async def _clean_db():
    async with engine.begin() as conn:
        await conn.execute(
            text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
        )
    yield


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def make_user():
    async def _make(role: str = "client", email: str | None = None, password: str = "pass1234"):
        async with async_session_factory() as session:
            user = await UserRepository(session).create(
                name=f"Test {role}",
                email=email or f"{role}-{os.urandom(4).hex()}@test.dev",
                role=role,
                password_hash=get_password_hash(password),
            )
            await session.commit()
        token = create_access_token(user_id=user.id, role=user.role)
        return user, {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture
def make_freelancer():
    async def _make(**fields):
        defaults = dict(
            name="Freelancer",
            skills=["Python"],
            rating=4.5,
            hourly_rate=50.0,
            experience_years=5,
            account_age_days=400,
            fraud_score=0.05,
            bio="Backend engineer",
            location="Remote",
            availability=True,
            review_count=10,
            portfolio_urls=[],
        )
        defaults.update(fields)
        async with async_session_factory() as session:
            freelancer = await FreelancerRepository(session).create(**defaults)
            await session.commit()
        return freelancer

    return _make


@pytest.fixture
def make_project():
    async def _make(client_id: int | None, **fields):
        defaults = dict(
            title="Project",
            description="Build things",
            required_skills=["Python"],
            budget=10_000.0,
            deadline_days=30,
            team_size=1,
        )
        defaults.update(fields)
        async with async_session_factory() as session:
            project = await ProjectRepository(session).create(client_id=client_id, **defaults)
            await session.commit()
        return project

    return _make


@pytest.fixture
async def neo4j_graph(monkeypatch):
    """Enable Neo4j against TEST_NEO4J_URI with an empty graph; skip if unreachable."""
    from app.core.config import settings
    from app.graph import driver

    monkeypatch.setattr(settings, "neo4j_uri", TEST_NEO4J_URI)
    monkeypatch.setattr(settings, "neo4j_password", TEST_NEO4J_PASSWORD)
    await driver.close_driver()
    if await driver.ping() != "ok":
        await driver.close_driver()
        pytest.skip(f"Neo4j not reachable at {TEST_NEO4J_URI}")
    await driver.run("MATCH (n) DETACH DELETE n")
    yield driver
    await driver.run("MATCH (n) DETACH DELETE n")
    await driver.close_driver()
