from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import SkillRelationship


class SkillRelationshipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[SkillRelationship]:
        result = await self._session.execute(select(SkillRelationship))
        return list(result.scalars().all())

    async def upsert_pair(self, skill_a: str, skill_b: str) -> None:
        stmt = (
            insert(SkillRelationship)
            .values(skill_a=skill_a, skill_b=skill_b)
            .on_conflict_do_nothing(index_elements=["skill_a", "skill_b"])
        )
        await self._session.execute(stmt)

    async def delete_all(self) -> None:
        await self._session.execute(delete(SkillRelationship))
