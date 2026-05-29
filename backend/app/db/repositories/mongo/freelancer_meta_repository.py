from datetime import datetime, timezone
from typing import Any, Optional

from app.db import mongodb as mongo_db


class FreelancerMetaRepository:
    @property
    def _collection(self):
        return mongo_db.get_database()[mongo_db.COLLECTION_FREELANCER_META]

    async def upsert(
        self,
        *,
        freelancer_id: int,
        tags: Optional[list[str]] = None,
        social_links: Optional[dict[str, str]] = None,
        verification: Optional[dict[str, Any]] = None,
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        document = {
            "freelancer_id": freelancer_id,
            "tags": tags or [],
            "social_links": social_links or {},
            "verification": verification or {},
            "extra": extra or {},
            "updated_at": now,
        }
        await self._collection.update_one(
            {"freelancer_id": freelancer_id},
            {"$set": document, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    async def get_by_freelancer_id(self, freelancer_id: int) -> Optional[dict[str, Any]]:
        return await self._collection.find_one({"freelancer_id": freelancer_id})
