from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None

COLLECTION_ACTIVITY_LOGS = "activity_logs"
COLLECTION_SEARCH_HISTORY = "search_history"
COLLECTION_AI_EXPLANATIONS = "ai_explanations"
COLLECTION_FREELANCER_META = "freelancer_meta"


def get_mongo_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return _client


def get_database() -> AsyncIOMotorDatabase:
    return get_mongo_client()[settings.mongodb_db]


async def init_mongodb() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_url)
    await _client.admin.command("ping")
    db = get_database()

    await db[COLLECTION_ACTIVITY_LOGS].create_index("timestamp")
    await db[COLLECTION_ACTIVITY_LOGS].create_index("endpoint")

    await db[COLLECTION_SEARCH_HISTORY].create_index("timestamp")
    await db[COLLECTION_SEARCH_HISTORY].create_index("query")

    await db[COLLECTION_AI_EXPLANATIONS].create_index("timestamp")
    await db[COLLECTION_AI_EXPLANATIONS].create_index("endpoint")
    await db[COLLECTION_AI_EXPLANATIONS].create_index("freelancer_id")

    await db[COLLECTION_FREELANCER_META].create_index("freelancer_id", unique=True)
    await db[COLLECTION_FREELANCER_META].create_index("updated_at")


async def close_mongodb() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
