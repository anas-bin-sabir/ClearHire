from datetime import datetime, timezone
from typing import Any, Optional

from app.db import mongodb as mongo_db


class AIExplanationRepository:
    @property
    def _collection(self):
        return mongo_db.get_database()[mongo_db.COLLECTION_AI_EXPLANATIONS]

    async def insert(
        self,
        *,
        endpoint: str,
        explanation: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        freelancer_id: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        document = {
            "endpoint": endpoint,
            "explanation": explanation,
            "model": model,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "freelancer_id": freelancer_id,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc),
        }
        result = await self._collection.insert_one(document)
        return str(result.inserted_id)

    async def get_latest(
        self,
        *,
        entity_id: int,
        entity_type: Optional[str] = None,
        pipeline: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Most recent agent explanation for an entity, newest ran_at first."""
        query: dict[str, Any] = {"entity_id": entity_id}
        if entity_type is not None:
            query["entity_type"] = entity_type
        if pipeline is not None:
            query["pipeline"] = pipeline
        doc = await self._collection.find_one(query, sort=[("ran_at", -1)])
        if doc is None:
            return None
        doc.pop("_id", None)
        ran_at = doc.get("ran_at")
        if ran_at is not None and hasattr(ran_at, "isoformat"):
            doc["ran_at"] = ran_at.isoformat()
        timestamp = doc.get("timestamp")
        if timestamp is not None and hasattr(timestamp, "isoformat"):
            doc["timestamp"] = timestamp.isoformat()
        return doc
