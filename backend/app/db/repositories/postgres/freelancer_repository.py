import re
from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy import and_, delete, func, literal_column, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_text, freelancer_embedding_text
from app.ai.skill_taxonomy import canonicalize_all
from app.core.config import settings
from app.db.utils.serializers import freelancer_to_dict
from app.models.orm import Contract, ContractStatus, Freelancer, Project

_EMBED_FIELDS = {"name", "bio", "skills", "location"}

RetrievalMode = Literal["hybrid", "vector", "keyword"]
RRF_K = 60  # standard Reciprocal Rank Fusion constant (Cormack et al., 2009)
_TOKEN = re.compile(r"[a-z0-9]+")


def keyword_tsquery(text_: str, max_terms: int = 32) -> str:
    """OR-query of the distinct terms, for to_tsquery('english', ...).

    Briefs are long natural-language text, so AND semantics (plainto/websearch)
    would match almost nothing; ts_rank rewards documents matching more terms.
    """
    terms: list[str] = []
    for token in _TOKEN.findall((text_ or "").lower()):
        if len(token) > 1 and token not in terms:
            terms.append(token)
    return " | ".join(terms[:max_terms])


@dataclass
class RetrievedCandidate:
    freelancer: Freelancer
    similarity: float | None  # cosine similarity to the query; None without a query
    keyword_score: float = 0.0  # ts_rank relative to the best keyword hit (0..1)
    semantic_rank: int | None = None
    keyword_rank: int | None = None
    rrf_score: float = 0.0
    skill_filter: Literal["strict", "relaxed", "none"] = "none"


@dataclass
class RetrievalResult:
    candidates: list[RetrievedCandidate] = field(default_factory=list)
    mode: RetrievalMode = "hybrid"
    # strict: every candidate has a must-have skill; relaxed: too few did, so the
    # skill overlap filter was dropped to fill the shortlist.
    skill_filter: Literal["strict", "relaxed", "none"] = "none"


class FreelancerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, freelancer_id: int) -> Freelancer | None:
        result = await self._session.execute(
            select(Freelancer).where(Freelancer.id == freelancer_id)
        )
        return result.scalar_one_or_none()

    def _filtered_stmt(
        self,
        *,
        search: str | None = None,
        skill: str | None = None,
        skills_any: list[str] | None = None,
        min_rating: float | None = None,
        max_hourly_rate: float | None = None,
        min_hourly_rate: float | None = None,
        availability: bool | None = None,
        max_fraud_score: float | None = None,
        flagged_only: bool = False,
        require_embedding: bool = False,
    ):
        stmt = select(Freelancer)
        clauses = []
        if flagged_only:
            clauses.append(Freelancer.fraud_score >= 0.6)
        if search and search.strip():
            term = search.strip()
            search_clauses = [
                Freelancer.name.ilike(f"%{term}%"),
                Freelancer.bio.ilike(f"%{term}%"),
            ]
            if term.isdigit():
                search_clauses.append(Freelancer.id == int(term))
            clauses.append(or_(*search_clauses))
        if skill:
            clauses.append(Freelancer.skills.any(skill))
        if skills_any:
            clauses.append(Freelancer.skills.overlap(skills_any))
        if min_rating is not None:
            clauses.append(Freelancer.rating >= min_rating)
        if min_hourly_rate is not None:
            clauses.append(Freelancer.hourly_rate >= min_hourly_rate)
        if max_hourly_rate is not None:
            clauses.append(Freelancer.hourly_rate <= max_hourly_rate)
        if availability is not None:
            clauses.append(Freelancer.availability.is_(availability))
        if max_fraud_score is not None:
            clauses.append(Freelancer.fraud_score <= max_fraud_score)
        if require_embedding:
            clauses.append(Freelancer.embedding.is_not(None))
        if clauses:
            stmt = stmt.where(and_(*clauses))
        return stmt

    async def list_filtered(
        self,
        *,
        search: str | None = None,
        skill: str | None = None,
        min_rating: float | None = None,
        max_hourly_rate: float | None = None,
        min_hourly_rate: float | None = None,
        availability: bool | None = None,
        max_fraud_score: float | None = None,
        flagged_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Freelancer], int]:
        filters = dict(
            search=search,
            skill=skill,
            min_rating=min_rating,
            max_hourly_rate=max_hourly_rate,
            min_hourly_rate=min_hourly_rate,
            availability=availability,
            max_fraud_score=max_fraud_score,
            flagged_only=flagged_only,
        )
        count_stmt = select(func.count()).select_from(
            self._filtered_stmt(**filters).subquery()
        )
        total = int((await self._session.execute(count_stmt)).scalar_one())
        offset = max(page - 1, 0) * page_size
        stmt = (
            self._filtered_stmt(**filters)
            .order_by(Freelancer.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        return rows, total

    async def search(
        self,
        *,
        q: str | None = None,
        limit: int = 50,
        flagged_only: bool = False,
    ) -> list[Freelancer]:
        rows, _ = await self.list_filtered(
            search=q, flagged_only=flagged_only, page=1, page_size=limit
        )
        return rows

    async def list_available(
        self, *, max_fraud_score: float = 0.7, limit: int = 50
    ) -> list[Freelancer]:
        rows, _ = await self.list_filtered(
            availability=True,
            max_fraud_score=max_fraud_score,
            page=1,
            page_size=limit,
        )
        return rows

    async def _semantic_channel(
        self, base_stmt, query_vector: list[float], limit: int
    ) -> list[tuple[int, float]]:
        distance = Freelancer.embedding.cosine_distance(query_vector)
        stmt = (
            base_stmt.with_only_columns(Freelancer.id, distance)
            .where(Freelancer.embedding.is_not(None))
            .order_by(distance, Freelancer.id)
            .limit(limit)
        )
        return [(row[0], float(row[1])) for row in (await self._session.execute(stmt)).all()]

    async def _keyword_channel(
        self, base_stmt, tsquery: str, limit: int
    ) -> list[tuple[int, float]]:
        if not tsquery:
            return []
        query = func.to_tsquery(literal_column("'english'::regconfig"), tsquery)
        rank = func.ts_rank(Freelancer.search_vector, query)
        stmt = (
            base_stmt.with_only_columns(Freelancer.id, rank)
            .where(Freelancer.search_vector.op("@@")(query))
            .order_by(rank.desc(), Freelancer.id)
            .limit(limit)
        )
        return [(row[0], float(row[1])) for row in (await self._session.execute(stmt)).all()]

    async def _tune_hnsw(self, limit: int) -> None:
        # ef_search bounds how many neighbours HNSW returns (default 40). Iterative
        # scans (pgvector >= 0.8) keep searching when WHERE filters discard rows.
        # set_config(..., true) is transaction-local, like SET LOCAL.
        await self._session.execute(
            text(
                "SELECT set_config('hnsw.ef_search', :ef, true), "
                "set_config('hnsw.iterative_scan', 'relaxed_order', true)"
            ),
            {"ef": str(max(40, min(1000, limit * 2)))},
        )

    async def _fused_pass(
        self,
        base_stmt,
        query: str,
        query_vector: list[float],
        mode: RetrievalMode,
        limit: int,
    ) -> list[tuple[int, int | None, int | None, float, float]]:
        """Run the channels and fuse them: (id, sem_rank, kw_rank, kw_score, rrf)."""
        semantic = (
            await self._semantic_channel(base_stmt, query_vector, limit)
            if mode in ("hybrid", "vector")
            else []
        )
        keyword = (
            await self._keyword_channel(base_stmt, keyword_tsquery(query), limit)
            if mode in ("hybrid", "keyword")
            else []
        )
        best_kw = max((score for _, score in keyword), default=0.0) or 1.0
        fused: dict[int, list] = {}
        for rank, (fid, _) in enumerate(semantic, start=1):
            fused.setdefault(fid, [fid, None, None, 0.0, 0.0])
            fused[fid][1] = rank
            fused[fid][4] += 1.0 / (RRF_K + rank)
        keyword_weight = settings.search_keyword_rrf_weight
        for rank, (fid, score) in enumerate(keyword, start=1):
            fused.setdefault(fid, [fid, None, None, 0.0, 0.0])
            fused[fid][2] = rank
            fused[fid][3] = score / best_kw
            fused[fid][4] += keyword_weight / (RRF_K + rank)
        rows = sorted(fused.values(), key=lambda r: (-r[4], r[0]))
        return [tuple(r) for r in rows[:limit]]

    async def hybrid_retrieve(
        self,
        query: str | None,
        *,
        must_skills: list[str] | None = None,
        mode: RetrievalMode = "hybrid",
        limit: int = 100,
        min_results: int = 20,
        max_fraud_score: float = 1.0,
        min_rate: float | None = None,
        max_rate: float | None = None,
        min_rating: float | None = None,
        available_only: bool = False,
    ) -> RetrievalResult:
        """Hard filters in SQL, then semantic (pgvector HNSW) + keyword (tsvector)
        channels merged with Reciprocal Rank Fusion.

        Must-have skills are a SQL overlap filter; when that leaves fewer than
        ``min_results`` candidates, a second pass without it tops the list up.
        """
        filters = dict(
            min_rating=min_rating,
            min_hourly_rate=min_rate,
            max_hourly_rate=max_rate,
            availability=True if available_only else None,
            max_fraud_score=max_fraud_score,
        )
        must = canonicalize_all(must_skills)
        passes: list[tuple[str, Any]] = (
            [("strict", self._filtered_stmt(skills_any=must, **filters)),
             ("relaxed", self._filtered_stmt(**filters))]
            if must
            else [("none", self._filtered_stmt(**filters))]
        )

        if not (query and query.strip()):
            return await self._list_without_query(passes, limit, min_results)

        query_vector = embed_text(query)
        if mode != "keyword":
            await self._tune_hnsw(limit)

        fused: list[tuple[str, tuple]] = []
        seen: set[int] = set()
        used = "none"
        for label, stmt in passes:
            if label == "relaxed" and len(fused) >= min_results:
                break
            for row in await self._fused_pass(stmt, query, query_vector, mode, limit):
                if row[0] not in seen and len(fused) < limit:
                    seen.add(row[0])
                    fused.append((label, row))
            used = label

        if not fused:
            return RetrievalResult(mode=mode, skill_filter=used)
        # One round-trip for the rows plus a true similarity for keyword-only hits.
        distance = Freelancer.embedding.cosine_distance(query_vector)
        loaded = {
            fl.id: (fl, dist)
            for fl, dist in (
                await self._session.execute(
                    select(Freelancer, distance).where(Freelancer.id.in_(seen))
                )
            ).all()
        }
        candidates = []
        for label, (fid, sem_rank, kw_rank, kw_score, rrf) in fused:
            freelancer, dist = loaded[fid]
            candidates.append(
                RetrievedCandidate(
                    freelancer=freelancer,
                    similarity=None if dist is None else max(0.0, min(1.0, 1.0 - float(dist))),
                    keyword_score=round(kw_score, 6),
                    semantic_rank=sem_rank,
                    keyword_rank=kw_rank,
                    rrf_score=round(rrf, 6),
                    skill_filter=label,
                )
            )
        return RetrievalResult(candidates=candidates, mode=mode, skill_filter=used)

    async def _list_without_query(
        self, passes: list[tuple[str, Any]], limit: int, min_results: int
    ) -> RetrievalResult:
        candidates: list[RetrievedCandidate] = []
        seen: set[int] = set()
        used = "none"
        for label, stmt in passes:
            if label == "relaxed" and len(candidates) >= min_results:
                break
            rows = (
                await self._session.execute(
                    stmt.order_by(Freelancer.rating.desc(), Freelancer.id).limit(limit)
                )
            ).scalars()
            for freelancer in rows:
                if freelancer.id not in seen and len(candidates) < limit:
                    seen.add(freelancer.id)
                    candidates.append(
                        RetrievedCandidate(freelancer=freelancer, similarity=None, skill_filter=label)
                    )
            used = label
        return RetrievalResult(candidates=candidates, mode="hybrid", skill_filter=used)

    async def list_for_team_building(
        self, max_fraud_score: float = 0.6, limit: int = 500
    ) -> list[Freelancer]:
        return await self.list_available(max_fraud_score=max_fraud_score, limit=limit)

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

    async def past_project_titles(self, freelancer_id: int, limit: int = 10) -> list[str]:
        """Titles of the freelancer's completed projects, newest first."""
        result = await self._session.execute(
            select(Project.title)
            .join(Contract, Contract.project_id == Project.id)
            .where(
                Contract.freelancer_id == freelancer_id,
                Contract.status == ContractStatus.COMPLETED.value,
                Project.title.is_not(None),
            )
            .order_by(Contract.created_at.desc())
            .limit(limit)
        )
        return [title for title in result.scalars().all() if title]

    async def completed_projects_for(
        self, freelancer_ids: list[int], per_freelancer: int = 5
    ) -> dict[int, list[tuple[int, str]]]:
        """{freelancer id: [(project id, title)]} of completed work, newest first."""
        projects: dict[int, list[tuple[int, str]]] = {fid: [] for fid in freelancer_ids}
        if not freelancer_ids:
            return projects
        result = await self._session.execute(
            select(Contract.freelancer_id, Project.id, Project.title)
            .join(Project, Contract.project_id == Project.id)
            .where(
                Contract.freelancer_id.in_(freelancer_ids),
                Contract.status == ContractStatus.COMPLETED.value,
                Project.title.is_not(None),
            )
            .order_by(Contract.created_at.desc())
        )
        for fid, project_id, title in result.all():
            if len(projects[fid]) < per_freelancer:
                projects[fid].append((project_id, title))
        return projects

    async def refresh_embedding(self, freelancer: Freelancer) -> None:
        """Re-embed profile text plus completed project titles."""
        freelancer.embedding = embed_text(
            freelancer_embedding_text(
                name=freelancer.name or "",
                bio=freelancer.bio,
                skills=freelancer.skills,
                location=freelancer.location,
                past_projects=await self.past_project_titles(freelancer.id),
            )
        )
        await self._session.flush()

    async def create(self, **fields: Any) -> Freelancer:
        if "skills" in fields:
            fields["skills"] = canonicalize_all(fields["skills"])
        if "embedding" not in fields:
            fields["embedding"] = embed_text(
                freelancer_embedding_text(
                    name=fields.get("name") or "",
                    bio=fields.get("bio"),
                    skills=fields.get("skills"),
                    location=fields.get("location"),
                )
            )
        freelancer = Freelancer(**fields)
        self._session.add(freelancer)
        await self._session.flush()
        await self._session.refresh(freelancer)
        return freelancer

    async def update(self, freelancer_id: int, data: dict) -> Freelancer | None:
        freelancer = await self.get_by_id(freelancer_id)
        if freelancer:
            data = dict(data)
            if "skills" in data:
                data["skills"] = canonicalize_all(data["skills"])
            for key, value in data.items():
                if hasattr(freelancer, key):
                    setattr(freelancer, key, value)
            if not _EMBED_FIELDS.isdisjoint(data.keys()):
                await self.refresh_embedding(freelancer)
            await self._session.flush()
            await self._session.refresh(freelancer)
        return freelancer

    async def delete_all(self) -> None:
        await self._session.execute(delete(Freelancer))

    @staticmethod
    def to_ranked_dicts(
        candidates: list[RetrievedCandidate],
        *,
        default_similarity: float = 0.5,
    ) -> list[dict]:
        """Serialize retrieval rows, carrying the channel scores into ranking."""
        ranked: list[dict] = []
        for item in candidates:
            data = freelancer_to_dict(item.freelancer)
            data["embedding_similarity"] = (
                default_similarity if item.similarity is None else item.similarity
            )
            data["keyword_score"] = item.keyword_score
            data["retrieval"] = {
                "semantic_rank": item.semantic_rank,
                "keyword_rank": item.keyword_rank,
                "rrf_score": item.rrf_score,
                "skill_filter": item.skill_filter,
            }
            ranked.append(data)
        return ranked
