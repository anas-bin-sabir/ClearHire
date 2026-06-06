from datetime import datetime, timezone
from typing import Any, Optional

from app.db import mongodb as mongo_db


class ActivityLogRepository:
    @property
    def _collection(self):
        return mongo_db.get_database()[mongo_db.COLLECTION_ACTIVITY_LOGS]

    async def insert(
        self,
        *,
        endpoint: str,
        method: str,
        payload: Optional[dict[str, Any]] = None,
        response_summary: Optional[dict[str, Any]] = None,
        status: str = "success",
        error: Optional[str] = None,
    ) -> str:
        document = {
            "endpoint": endpoint,
            "method": method,
            "payload": payload or {},
            "response_summary": response_summary or {},
            "status": status,
            "error": error,
            "timestamp": datetime.now(timezone.utc),
        }
        result = await self._collection.insert_one(document)
        return str(result.inserted_id)

    async def count_successful(self, *, endpoint: str) -> int:
        return await self._collection.count_documents(
            {"endpoint": endpoint, "status": "success"}
        )

    async def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find({"status": "success"})
            .sort("timestamp", -1)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)
