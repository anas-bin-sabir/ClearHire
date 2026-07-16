import logging

from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.url import database_config_from_settings

logger = logging.getLogger(__name__)

# hnsw.iterative_scan (used by the freelancer vector search) needs pgvector >= 0.8.
MIN_PGVECTOR_VERSION = (0, 8)

db_config = database_config_from_settings(settings)
database_url = db_config.url_string
for _warning in db_config.warnings:
    logger.warning(_warning)

engine = create_async_engine(
    database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    connect_args=db_config.connect_args,
    # NullPool keeps connections from outliving the event loop that opened them
    # (needed by the test suite, where each test may run on its own loop).
    **(
        {"poolclass": pool.NullPool}
        if settings.db_null_pool
        else {"pool_size": settings.db_pool_size, "max_overflow": settings.db_max_overflow}
    ),
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _parse_version(raw: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in raw.split("."):
        digits = "".join(ch for ch in piece if ch.isdigit())
        if not digits:
            break
        parts.append(int(digits))
    return tuple(parts)


async def _check_pgvector(conn: AsyncConnection) -> None:
    """Warn (never fail) when pgvector is missing or too old for iterative scans."""
    try:
        version = await conn.scalar(
            text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        )
    except Exception:  # pragma: no cover - diagnostic only
        logger.warning("Could not read the installed pgvector version", exc_info=True)
        return
    if version is None:
        logger.warning("pgvector extension is not installed in this database")
    elif _parse_version(version) < MIN_PGVECTOR_VERSION:
        logger.warning(
            "pgvector %s is installed; >= 0.8 is required for hnsw.iterative_scan "
            "(filtered vector search may return too few results)",
            version,
        )


async def init_postgres() -> None:
    """Bring the schema to the latest Alembic revision (or just verify connectivity)."""
    async with engine.begin() as conn:
        if settings.auto_migrate:
            from app.db.migrate import upgrade_to_head

            await conn.run_sync(upgrade_to_head)
        else:
            await conn.execute(text("SELECT 1"))
    async with engine.connect() as conn:
        await _check_pgvector(conn)


async def close_postgres() -> None:
    await engine.dispose()
