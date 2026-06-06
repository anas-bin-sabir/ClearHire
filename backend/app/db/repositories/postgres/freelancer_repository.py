from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.utils.embeddings import attach_embedding_similarity
from app.models.orm import Freelancer


class FreelancerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, freelancer_id: int) -> Freelancer | None:
        result = await self._session.execute(
            select(Freelancer).where(Freelancer.id == freelancer_id)
        )
        return result.scalar_one_or_none()

    async def list_available(
        self,
        *,
        max_fraud_score: float = 0.7,
    ) -> list[Freelancer]:
        result = await self._session.execute(
            select(Freelancer).where(
                Freelancer.availability.is_(True),
                Freelancer.fraud_score < max_fraud_score,
            )
        )
        return list(result.scalars().all())

    async def list_for_team_building(self, max_fraud_score: float = 0.6) -> list[Freelancer]:
        return await self.list_available(max_fraud_score=max_fraud_score)

    async def list_graph_preview(
        self, limit: int = 30
    ) -> list[tuple[int, str, list[str], float]]:
        result = await self._session.execute(
            select(
                Freelancer.id,
                Freelancer.name,
                Freelancer.skills,
                Freelancer.fraud_score,
            ).limit(limit)
        )
        return [
            (row.id, row.name, list(row.skills or []), float(row.fraud_score or 0))
            for row in result.all()
        ]

    async def count_all(self) -> int:
        result = await self._session.execute(select(func.count()).select_from(Freelancer))
        return int(result.scalar_one())

    async def list_distinct_skills(self) -> list[str]:
        result = await self._session.execute(select(Freelancer.skills))
        skills: set[str] = set()
        for row in result.scalars().all():
            for skill in row or []:
                if skill:
                    skills.add(skill)
        return sorted(skills)

    async def count_flagged(self, threshold: float = 0.6) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(Freelancer)
            .where(Freelancer.fraud_score >= threshold)
        )
        return int(result.scalar_one())

    async def search(
        self,
        *,
        q: str | None = None,
        limit: int = 50,
        flagged_only: bool = False,
    ) -> list[Freelancer]:
        stmt = select(Freelancer)
        if flagged_only:
            stmt = stmt.where(Freelancer.fraud_score >= 0.6)
        if q and q.strip():
            term = q.strip()
            clauses = [Freelancer.name.ilike(f"%{term}%")]
            if term.isdigit():
                clauses.append(Freelancer.id == int(term))
            stmt = stmt.where(or_(*clauses))
        stmt = stmt.order_by(Freelancer.fraud_score.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, **fields: Any) -> Freelancer:
        freelancer = Freelancer(**fields)
        self._session.add(freelancer)
        await self._session.flush()
        await self._session.refresh(freelancer)
        return freelancer

    async def delete_all(self) -> None:
        await self._session.execute(delete(Freelancer))

    async def to_ranked_dicts(
        self,
        freelancers: list[Freelancer],
        query_embedding: list[float] | None = None,
    ) -> list[dict]:
        return attach_embedding_similarity(freelancers, query_embedding)

    async def filter_dicts(
        self,
        candidates: list[dict],
        *,
        skills: list[str] | None = None,
        min_rate: float | None = None,
        max_rate: float | None = None,
        min_rating: float | None = None,
        available_only: bool = False,
        max_fraud: float = 1.0,
    ) -> list[dict]:
        filtered = candidates
        if skills:
            filtered = [
                c
                for c in filtered
                if any(s in (c.get("skills") or []) for s in skills)
            ]
        if min_rate is not None:
            filtered = [c for c in filtered if c["hourly_rate"] >= min_rate]
        if max_rate is not None:
            filtered = [c for c in filtered if c["hourly_rate"] <= max_rate]
        if min_rating is not None and min_rating > 0:
            filtered = [c for c in filtered if c.get("rating", 0) >= min_rating]
        if available_only:
            filtered = [c for c in filtered if c.get("availability", True)]
        filtered = [
            c for c in filtered if float(c.get("fraud_score", 0)) <= max_fraud
        ]
        return filtered
