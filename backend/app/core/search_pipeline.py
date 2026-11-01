"""Retrieve-then-rank pipeline shared by POST /search and the offline eval."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from app.ai import llm
from app.ai.ranking import rank_freelancers
from app.ai.rerank import (
    LLMRerankOutput,
    ProjectContext,
    RerankResult,
    cache_key,
    candidate_card,
    card_project_titles,
    deterministic_result,
    judge_with_llm,
    llm_result,
)
from app.ai.types import (
    FreelancerCandidate,
    ProjectConstraints,
    RankedFreelancer,
    RankingWeights,
)
from app.core.config import settings
from app.db.repositories.postgres import (
    AIExplanationRepository,
    FreelancerRepository,
    SkillRelationshipRepository,
)
from app.db.repositories.postgres.freelancer_repository import RetrievalMode, RetrievalResult
from app.models.schemas import SearchRequest

if TYPE_CHECKING:
    from app.graph.context import GraphContext

logger = logging.getLogger(__name__)

RETRIEVAL_LIMIT = 100
RESULT_LIMIT = 20
PRECOMPUTED_PIPELINE = "precomputed_search"


@dataclass
class GraphUsage:
    """Which graph backend fed this search and what it added (API ``graph`` field)."""

    source: str  # "neo4j" | "postgres" | "off" (no graph context) | "error"
    # {required skill (lower): {related skill (lower): weight}} from expand_skills
    expanded_skills: dict[str, dict[str, float]] = field(default_factory=dict)
    error: str | None = None

    def meta(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "expanded_skills": {
                skill: {k: round(v, 3) for k, v in sorted(rel.items(), key=lambda kv: -kv[1])}
                for skill, rel in self.expanded_skills.items()
            },
            "error": self.error,
        }


@dataclass
class SearchOutcome:
    retrieval: RetrievalResult
    candidates: list[FreelancerCandidate]
    ranked: list[RankedFreelancer]  # every shortlisted candidate, best first
    graph: GraphUsage = field(default_factory=lambda: GraphUsage(source="off"))
    graph_context: "GraphContext | None" = None


def merge_adjacency(
    base: dict[str, dict[str, float]], extra: dict[str, dict[str, float]]
) -> dict[str, dict[str, float]]:
    """Union of two adjacency maps; the larger weight wins per pair."""
    merged = {skill: dict(rel) for skill, rel in base.items()}
    for skill, rel in extra.items():
        target = merged.setdefault(skill.lower(), {})
        for other, weight in rel.items():
            key = other.lower()
            if key != skill.lower() and weight > target.get(key, 0.0):
                target[key] = weight
    return merged


class FallbackGraphContext:
    """Neo4j GraphContext that retries on Postgres if a call fails mid-request.

    get_graph_context() only checks reachability once, so an outage during
    expand_skills/candidate_subgraph would otherwise raise. After the first
    failure every later call goes to Postgres and ``source`` reports "postgres".
    """

    def __init__(self, primary: "GraphContext", session) -> None:
        self._primary = primary
        self._session = session
        self._fallback: "GraphContext | None" = None

    @property
    def source(self) -> str:
        return (self._fallback or self._primary).source

    def _postgres(self) -> "GraphContext":
        if self._fallback is None:
            from app.graph.postgres_context import PostgresGraphContext

            self._fallback = PostgresGraphContext(self._session)
        return self._fallback

    async def _call(self, name: str, *args, **kwargs):
        if self._fallback is None:
            try:
                return await getattr(self._primary, name)(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 - retried on the authoritative store
                logger.warning("%s via %s failed, retrying on postgres: %s",
                               name, self._primary.source, exc)
        return await getattr(self._postgres(), name)(*args, **kwargs)

    async def expand_skills(self, skills, **kwargs):
        return await self._call("expand_skills", skills, **kwargs)

    async def candidate_subgraph(self, freelancer_ids, required_skills, **kwargs):
        return await self._call("candidate_subgraph", freelancer_ids, required_skills, **kwargs)


async def resolve_graph_context(session) -> "GraphContext | None":
    """get_graph_context() that never raises: None means "no graph this request".
    A Neo4j context is wrapped so mid-request failures retry on Postgres."""
    try:
        from app.graph.context import get_graph_context

        graph = await get_graph_context(session)
    except Exception as exc:  # noqa: BLE001 - graph is optional
        logger.warning("graph context unavailable: %s", exc)
        return None
    if graph.source == "neo4j":
        return FallbackGraphContext(graph, session)
    return graph


async def expand_with_graph(
    graph: "GraphContext | None", skills: list[str]
) -> GraphUsage:
    """Multi-hop expansion of the search skills; never raises (graph is optional)."""
    if graph is None:
        return GraphUsage(source="off")
    if not skills:
        return GraphUsage(source=graph.source)
    try:
        expanded = await graph.expand_skills(skills)
    except Exception as exc:  # noqa: BLE001 - a graph outage must not fail search
        logger.warning("graph expansion via %s failed: %s", graph.source, exc)
        return GraphUsage(source="error", error=str(exc))
    return GraphUsage(source=graph.source, expanded_skills=expanded)


async def run_search(
    body: SearchRequest,
    freelancers: FreelancerRepository,
    relationships: SkillRelationshipRepository,
    *,
    mode: RetrievalMode = "hybrid",
    weights: RankingWeights | None = None,
    graph: "GraphContext | None" = None,
) -> SearchOutcome:
    """``graph`` enables GraphRAG expansion: multi-hop related skills give partial
    credit in ranking and widen the must-have filter before it is dropped. Without
    it (or if it fails) the curated ``skill_relationships`` adjacency is used alone.
    """
    # Stage 0: graph expansion of must-have and nice-to-have skills.
    usage = await expand_with_graph(graph, list(dict.fromkeys(body.skills + body.nice_to_have_skills)))
    must_keys = {s.lower() for s in body.skills}
    must_expansion: dict[str, float] = {}
    for skill, related in usage.expanded_skills.items():
        if skill.lower() in must_keys:
            for other, weight in related.items():
                must_expansion[other] = max(weight, must_expansion.get(other, 0.0))

    # Stage 1: hard filters in SQL, then pgvector ANN + full-text channels fused
    # with Reciprocal Rank Fusion.
    retrieval_text = body.query.strip() or " ".join(body.skills + body.nice_to_have_skills)
    retrieval = await freelancers.hybrid_retrieve(
        retrieval_text,
        must_skills=body.skills,
        expanded_skills=must_expansion or None,
        mode=mode,
        limit=RETRIEVAL_LIMIT,
        min_results=RESULT_LIMIT,
        max_fraud_score=body.max_fraud,
        min_rate=body.min_rate,
        max_rate=body.max_rate,
        min_rating=body.min_rating,
        available_only=body.available_only,
    )
    candidates = [
        FreelancerCandidate.from_dict(row)
        for row in freelancers.to_ranked_dicts(retrieval.candidates)
    ]

    # Stage 2: deterministic constraint ranking on the shortlist only.
    project = ProjectConstraints(
        required_skills=body.skills,
        nice_to_have_skills=body.nice_to_have_skills,
        budget=body.budget,
        budget_type=body.budget_type,
        team_size=body.team_size,
        hours_per_engagement=40.0,
        seniority_level=body.seniority_level,
        related_skills=merge_adjacency(await relationships.adjacency(), usage.expanded_skills),
    )
    ranked = rank_freelancers(candidates, project, weights).ranked
    return SearchOutcome(
        retrieval=retrieval,
        candidates=candidates,
        ranked=ranked,
        graph=usage,
        graph_context=graph if usage.source not in ("off", "error") else None,
    )


async def shortlist_graph(
    outcome: SearchOutcome, ids: list[int], required_skills: list[str]
) -> dict[int, dict[str, Any]]:
    """subgraph_to_prompt() facts per shortlisted id; {} without a graph or on error."""
    graph = outcome.graph_context
    if graph is None or not ids:
        return {}
    from app.graph.context import subgraph_to_prompt

    try:
        subgraphs = await graph.candidate_subgraph(ids, required_skills)
    except Exception as exc:  # noqa: BLE001 - explanations degrade, search continues
        logger.warning("candidate subgraph via %s failed: %s", graph.source, exc)
        outcome.graph.error = str(exc)
        return {}
    return {fid: subgraph_to_prompt(sub) for fid, sub in subgraphs.items() if fid in ids}


def project_context(body: SearchRequest) -> ProjectContext:
    return ProjectContext(
        brief=body.query,
        must_have_skills=body.skills,
        nice_to_have_skills=body.nice_to_have_skills,
        budget=body.budget,
        budget_type=body.budget_type,
        team_size=body.team_size,
        seniority_level=body.seniority_level,
    )


async def rerank_shortlist(
    outcome: SearchOutcome,
    body: SearchRequest,
    freelancers: FreelancerRepository,
    explanations: AIExplanationRepository,
    *,
    use_llm: bool = True,
) -> RerankResult:
    """Stage 3: LLM judgement of the top of the shortlist, blended with stage 2.

    Results are cached by (project, candidate cards, model), so repeating a search
    over unchanged profiles doesn't call the API again.
    """
    project = project_context(body)
    top_n, alpha = settings.rerank_top_n, settings.rerank_alpha
    ranked = outcome.ranked
    head = ranked[:top_n]
    head_ids = [r.candidate.id for r in head]
    # GraphRAG: skill paths, similar past projects and collaborations inside the
    # shortlist go onto each card (and into the deterministic reasoning).
    graphs = await shortlist_graph(
        outcome, head_ids, list(dict.fromkeys(body.skills + body.nice_to_have_skills))
    )
    past = await freelancers.completed_projects_for(head_ids) if head_ids else {}
    cards = [
        candidate_card(item, past.get(item.candidate.id), graphs.get(item.candidate.id))
        for item in head
    ]
    titles = card_project_titles(cards)

    def fallback(error: str | None = None) -> RerankResult:
        return deterministic_result(
            ranked, project, alpha=alpha, top_n=top_n, error=error,
            graphs=graphs, project_titles=titles,
        )

    if not (use_llm and settings.rerank_enabled and llm.is_configured() and ranked):
        return fallback()

    key = cache_key(project, cards)

    cached = await explanations.find_cached(pipeline="rerank", cache_key=key)
    if cached:
        output = LLMRerankOutput.model_validate(cached["output"])
        return llm_result(
            ranked, project, output, cards,
            alpha=alpha, top_n=top_n, usage=cached.get("usage"), cached=True,
        )
    try:
        output, usage = await judge_with_llm(project, cards)
    except llm.LLMUnavailable as exc:
        logger.info("rerank fell back to deterministic: %s", exc)
        return fallback(str(exc))

    result = llm_result(
        ranked, project, output, cards,
        alpha=alpha, top_n=top_n, usage=usage.as_metadata(), cached=False,
    )
    await explanations.insert(
        endpoint="/search",
        explanation=f"rerank of {len(cards)} candidates",
        model=usage.model,
        system_prompt="rerank",
        user_prompt=body.query,
        pipeline="rerank",
        metadata={
            "cache_key": key,
            "output": output.model_dump(),
            "usage": usage.as_metadata(),
            "stripped_claims": result.stripped_claims,
        },
    )
    return result


def request_for_project(project) -> SearchRequest:
    brief = " ".join(part for part in (project.title, project.description) if part)
    return SearchRequest(
        query=brief[:2000],
        skills=list(project.required_skills or []),
        nice_to_have_skills=list(project.nice_to_have_skills or []),
        seniority_level=project.seniority_level or None,
        budget=project.budget if project.budget and project.budget > 0 else 10_000.0,
        budget_type=project.budget_type or "fixed",
        team_size=project.team_size or 1,
        max_fraud=0.7,
    )


async def precompute_project_matches(project_id: int) -> None:
    """Background task after project creation: shortlist, rank, rerank, store.

    Runs in its own session; failures are logged, never raised to the client.
    """
    from app.db.repositories.postgres import ProjectRepository
    from app.db.session import async_session_factory

    try:
        async with async_session_factory() as session:
            project = await ProjectRepository(session).get_by_id(project_id)
            if project is None:
                return
            body = request_for_project(project)
            freelancers = FreelancerRepository(session)
            explanations = AIExplanationRepository(session)
            outcome = await run_search(
                body, freelancers, SkillRelationshipRepository(session),
                graph=await resolve_graph_context(session),
            )
            reranked = await rerank_shortlist(outcome, body, freelancers, explanations)
            shown = reranked.candidates[:RESULT_LIMIT]
            await explanations.insert(
                endpoint="/projects",
                explanation=f"{len(shown)} precomputed matches ({reranked.path} rerank)",
                model=(reranked.usage or {}).get("model", "deterministic"),
                system_prompt="precomputed_search",
                user_prompt=body.query,
                entity_id=project_id,
                entity_type="project",
                pipeline=PRECOMPUTED_PIPELINE,
                metadata={
                    "freelancers": [c.to_api_dict() for c in shown],
                    "reranking": reranked.meta(),
                    "retrieval": {
                        "mode": outcome.retrieval.mode,
                        "skill_filter": outcome.retrieval.skill_filter,
                    },
                    "graph": outcome.graph.meta(),
                    "total_candidates": len(outcome.candidates),
                },
            )
            await session.commit()
    except Exception:
        logger.exception("precomputing matches for project %s failed", project_id)
