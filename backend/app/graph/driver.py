"""Optional Neo4j async driver, gated on NEO4J_URI.

Neo4j is a derived read model: Postgres is authoritative, so every caller must
cope with ``get_driver()`` returning None (disabled) or a query failing (outage).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


def is_enabled() -> bool:
    return bool(settings.neo4j_uri)


def get_driver() -> AsyncDriver | None:
    """The process-wide driver, created lazily; None when Neo4j is disabled."""
    global _driver
    if not is_enabled():
        return None
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


async def close_driver() -> None:
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


async def run(query: str, **params: Any) -> list[dict[str, Any]]:
    """Run a Cypher query and return records as dicts. Raises if disabled."""
    driver = get_driver()
    if driver is None:
        raise RuntimeError("Neo4j is disabled (NEO4J_URI is unset)")
    result = await driver.execute_query(
        query, parameters_=params, database_=settings.neo4j_database
    )
    return [record.data() for record in result.records]


PING_TIMEOUT_SECONDS = 3.0


async def ping(timeout: float = PING_TIMEOUT_SECONDS) -> str:
    """'ok', 'error' or 'disabled'. Bounded: the driver retries for ~30 s otherwise."""
    driver = get_driver()
    if driver is None:
        return "disabled"
    try:
        await asyncio.wait_for(driver.verify_connectivity(), timeout)
        return "ok"
    except Exception as exc:  # noqa: BLE001 - reports, never raises
        logger.debug("neo4j ping failed: %s", exc)
        return "error"
