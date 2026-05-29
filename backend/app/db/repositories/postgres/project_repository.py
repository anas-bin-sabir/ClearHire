from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Project


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, project_id: int) -> Project | None:
        result = await self._session.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, limit: int = 100) -> list[Project]:
        result = await self._session.execute(select(Project).limit(limit))
        return list(result.scalars().all())

    async def create(self, **fields: Any) -> Project:
        project = Project(**fields)
        self._session.add(project)
        await self._session.flush()
        await self._session.refresh(project)
        return project

    async def delete_all(self) -> None:
        await self._session.execute(delete(Project))
