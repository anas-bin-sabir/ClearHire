from datetime import datetime, timezone
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.orm import ActivityLog, AIExplanation, UserSetting


class ActivityLogRepository:
    def __init__(self, session: AsyncSession): self.session = session
    async def insert(self, **data: Any) -> str:
        row = ActivityLog(**data, timestamp=datetime.now(timezone.utc)); self.session.add(row); await self.session.flush(); return str(row.id)
    async def count_successful(self, *, endpoint: str) -> int:
        result = await self.session.execute(select(func.count()).where(ActivityLog.endpoint == endpoint, ActivityLog.status == "success")); return int(result.scalar_one())
    async def count_by_window(self, *, endpoint: str, start: datetime, end: datetime, status: str = "success") -> int:
        result = await self.session.execute(
            select(func.count()).where(
                ActivityLog.endpoint == endpoint,
                ActivityLog.status == status,
                ActivityLog.timestamp >= start,
                ActivityLog.timestamp < end,
            )
        )
        return int(result.scalar_one())
    async def list_recent(self, limit: int = 20) -> list[dict]:
        result = await self.session.execute(
            select(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(limit)
        )
        rows = []
        for r in result.scalars():
            rows.append(
                {
                    "id": r.id,
                    "_id": r.id,
                    "endpoint": r.endpoint,
                    "method": r.method,
                    "payload": r.payload or {},
                    "response_summary": r.response_summary or {},
                    "status": r.status,
                    "error": r.error,
                    "timestamp": r.timestamp,
                }
            )
        return rows


class SearchHistoryRepository(ActivityLogRepository):
    async def insert(self, *, query: str, skills: list[str], filters: dict, result_count: int, top_freelancer_ids: list[int]) -> str:
        return await super().insert(
            endpoint="/search",
            method="POST",
            payload={"query": query, "skills": skills, "filters": filters},
            response_summary={"result_count": result_count, "top_freelancer_ids": top_freelancer_ids},
        )

    async def list_recent(self, limit: int = 20) -> list[dict]:
        rows = await super().list_recent(limit=max(limit * 4, limit))
        searches = []
        for row in rows:
            if row.get("endpoint") != "/search":
                continue
            payload = row.get("payload") or {}
            summary = row.get("response_summary") or {}
            searches.append(
                {
                    **row,
                    "query": payload.get("query")
                    or ", ".join(payload.get("skills") or []),
                    "skills": payload.get("skills") or [],
                    "result_count": summary.get("result_count")
                    or summary.get("returned", 0),
                }
            )
            if len(searches) >= limit:
                break
        return searches


class AIExplanationRepository:
    def __init__(self, session: AsyncSession): self.session = session
    async def insert(self, *, endpoint: str, explanation: str, model: str, system_prompt: str, user_prompt: str, freelancer_id: int | None = None, metadata: dict | None = None, **extra: Any) -> str:
        now = datetime.now(timezone.utc)
        row = AIExplanation(
            endpoint=endpoint,
            explanation=explanation,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            entity_id=extra.get("entity_id", freelancer_id),
            entity_type=extra.get("entity_type"),
            pipeline=extra.get("pipeline"),
            metadata_json=metadata or {},
            created_at=now,
            ran_at=now,
        )
        self.session.add(row)
        await self.session.flush()
        return str(row.id)
    async def get_latest(self, *, entity_id: int, entity_type: str | None = None, pipeline: str | None = None) -> dict | None:
        stmt = select(AIExplanation).where(AIExplanation.entity_id == entity_id).order_by(AIExplanation.ran_at.desc()).limit(1)
        if entity_type: stmt = stmt.where(AIExplanation.entity_type == entity_type)
        if pipeline: stmt = stmt.where(AIExplanation.pipeline == pipeline)
        result = await self.session.execute(stmt); row = result.scalar_one_or_none()
        if not row: return None
        return {"pipeline": row.pipeline, "ran_at": row.ran_at.isoformat(), "metadata": row.metadata_json, "explanation": row.explanation}


class UserSettingsRepository:
    def __init__(self, session: AsyncSession): self.session = session
    async def get(self, user_id: int) -> dict:
        result = await self.session.execute(select(UserSetting).where(UserSetting.user_id == user_id)); row = result.scalar_one_or_none(); return row.settings if row else {}
    async def save(self, user_id: int, settings: dict) -> dict:
        result = await self.session.execute(select(UserSetting).where(UserSetting.user_id == user_id)); row = result.scalar_one_or_none()
        if row: row.settings = settings; row.updated_at = datetime.now(timezone.utc)
        else: self.session.add(UserSetting(user_id=user_id, settings=settings))
        return settings
