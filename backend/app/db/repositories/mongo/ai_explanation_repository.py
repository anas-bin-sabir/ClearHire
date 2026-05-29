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
