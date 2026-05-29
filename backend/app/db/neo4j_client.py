from neo4j import AsyncDriver, AsyncGraphDatabase

from app.core.config import settings

neo4j_driver: AsyncDriver | None = None


async def init_neo4j() -> None:
    global neo4j_driver
    neo4j_driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )
    await neo4j_driver.verify_connectivity()


async def close_neo4j() -> None:
    global neo4j_driver
    if neo4j_driver is not None:
        await neo4j_driver.close()
        neo4j_driver = None


def get_neo4j_driver() -> AsyncDriver:
    if neo4j_driver is None:
        raise RuntimeError("Neo4j driver is not initialized")
    return neo4j_driver
