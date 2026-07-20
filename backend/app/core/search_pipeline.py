"""Retrieve-then-rank pipeline shared by POST /search and the offline eval."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.ai import llm
from app.ai.ranking import rank_freelancers
from app.ai.rerank import (
    LLMRerankOutput,
    ProjectContext,
    RerankResult,
    cache_key,
    candidate_card,
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

logger = logging.getLogger(__name__)

RETRIEVAL_LIMIT = 100
RESULT_LIMIT = 20
PRECOMPUTED_PIPELINE = "precomputed_search"


@dataclass
class SearchOutcome:
    retrieval: RetrievalResult
    candidates: list[FreelancerCandidate]
    ranked: list[RankedFreelancer]  # every shortlisted candidate, best first


async def run_search(
    body: SearchRequest,
    freelancers: FreelancerRepository,
    relationships: SkillRelationshipRepository,
    *,
    mode: RetrievalMode = "hybrid",
    weights: RankingWeights | None = None,
) -> SearchOutcome:
    # Stage 1: hard filters in SQL, then pgvector ANN + full-text channels fused
    # with Reciprocal Rank Fusion.
    retrieval_text = body.query.strip() or " ".join(body.skills + body.nice_to_have_skills)
    retrieval = await freelancers.hybrid_retrieve(
        retrieval_text,
        must_skills=body.skills,
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
        related_skills=await relationships.adjacency(),
    )
    ranked = rank_freelancers(candidates, project, weights).ranked
    return SearchOutcome(retrieval=retrieval, candidates=candidates, ranked=ranked)


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
    if not (use_llm and settings.rerank_enabled and llm.is_configured() and ranked):
        return deterministic_result(ranked, project, alpha=alpha, top_n=top_n)

    head = ranked[:top_n]
    past = await freelancers.completed_projects_for([r.candidate.id for r in head])
    cards = [candidate_card(item, past.get(item.candidate.id)) for item in head]
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
        return deterministic_result(ranked, project, alpha=alpha, top_n=top_n, error=str(exc))

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
            outcome = await run_search(body, freelancers, SkillRelationshipRepository(session))
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
                    "total_candidates": len(outcome.candidates),
                },
            )
            await session.commit()
    except Exception:
        logger.exception("precomputing matches for project %s failed", project_id)
