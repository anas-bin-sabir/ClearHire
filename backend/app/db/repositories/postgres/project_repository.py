from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_text, project_embedding_text
from app.ai.skill_taxonomy import canonicalize_all
from app.models.orm import Project

_EMBED_FIELDS = {
    "title",
    "description",
    "required_skills",
    "nice_to_have_skills",
    "implicit_constraints",
    "domain",
    "compliance",
}


def _normalize_skills(fields: dict[str, Any], project: Project | None = None) -> None:
    """Store canonical skill names; a skill is never both required and nice-to-have."""
    if "required_skills" in fields:
        fields["required_skills"] = canonicalize_all(fields["required_skills"])
    if "nice_to_have_skills" in fields:
        fields["nice_to_have_skills"] = canonicalize_all(fields["nice_to_have_skills"])
    required = fields.get(
        "required_skills", list(project.required_skills or []) if project else []
    )
    if "nice_to_have_skills" in fields:
        must = {s.lower() for s in required}
        fields["nice_to_have_skills"] = [
            s for s in fields["nice_to_have_skills"] if s.lower() not in must
        ]


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

    def _embed(self, project: Project) -> None:
        project.embedding = embed_text(
            project_embedding_text(
                title=project.title,
                description=project.description,
                required_skills=[
                    *(project.required_skills or []),
                    *(project.nice_to_have_skills or []),
                ],
                constraints=[
                    *(project.implicit_constraints or []),
                    *(project.compliance or []),
                    *([project.domain] if project.domain else []),
                ],
            )
        )

    async def create(self, **fields: Any) -> Project:
        _normalize_skills(fields)
        project = Project(**fields)
        if "embedding" not in fields:
            self._embed(project)
        self._session.add(project)
        await self._session.flush()
        await self._session.refresh(project)
        return project

    async def update(self, project_id: int, data: dict) -> Project | None:
        project = await self.get_by_id(project_id)
        if project:
            data = dict(data)
            _normalize_skills(data, project)
            for key, value in data.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            if set(data.keys()) & _EMBED_FIELDS:
                self._embed(project)
            await self._session.flush()
            await self._session.refresh(project)
        return project

    async def delete_all(self) -> None:
        await self._session.execute(delete(Project))
