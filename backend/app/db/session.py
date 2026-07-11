from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

database_url = settings.database_url
if database_url.startswith("postgres://"):
    database_url = "postgresql+asyncpg://" + database_url[len("postgres://") :]
elif database_url.startswith("postgresql://"):
    database_url = "postgresql+asyncpg://" + database_url[len("postgresql://") :]

engine = create_async_engine(
    database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    # NullPool keeps connections from outliving the event loop that opened them
    # (needed by the test suite, where each test may run on its own loop).
    **({"poolclass": pool.NullPool} if settings.db_null_pool else {}),
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_postgres() -> None:
    """Bring the schema to the latest Alembic revision (or just verify connectivity)."""
    async with engine.begin() as conn:
        if settings.auto_migrate:
            from app.db.migrate import upgrade_to_head

            await conn.run_sync(upgrade_to_head)
        else:
            await conn.execute(text("SELECT 1"))


async def close_postgres() -> None:
    await engine.dispose()
