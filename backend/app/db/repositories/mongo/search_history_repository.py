from datetime import datetime, timezone
from typing import Any, Optional

from app.db import mongodb as mongo_db


class SearchHistoryRepository:
    @property
    def _collection(self):
        return mongo_db.get_database()[mongo_db.COLLECTION_SEARCH_HISTORY]

    async def insert(
        self,
        *,
        query: str,
        skills: list[str],
        filters: dict[str, Any],
        result_count: int,
        top_freelancer_ids: list[int],
    ) -> str:
        document = {
            "query": query,
            "skills": skills,
            "filters": filters,
            "result_count": result_count,
            "top_freelancer_ids": top_freelancer_ids,
            "timestamp": datetime.now(timezone.utc),
        }
        result = await self._collection.insert_one(document)
        return str(result.inserted_id)

    async def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        cursor = self._collection.find().sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)
