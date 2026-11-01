import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.explainer import explain_search
from app.ai.types import SearchExplanationInput
from app.core.activity import log_activity
from app.core.dependencies import (
    get_ai_explanation_repo,
    get_db_session,
    get_freelancer_repo,
    get_graph_context_dep,
    get_search_history_repo,
    get_skill_repo,
)
from app.core.rate_limit import enforce_public_rate_limit
from app.core.search_pipeline import (
    PRECOMPUTED_PIPELINE,
    RESULT_LIMIT,
    rerank_shortlist,
    resolve_graph_context,
    run_search,
)
from app.db.repositories.postgres import (
    AIExplanationRepository,
    FreelancerRepository,
    SearchHistoryRepository,
    SkillRelationshipRepository,
)
from app.models.schemas import SearchRequest, SearchResponse

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(enforce_public_rate_limit)])


@router.post("", response_model=SearchResponse)
async def search_freelancers(
    body: SearchRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    search_history_repo: SearchHistoryRepository = Depends(get_search_history_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
    skill_relationship_repo: SkillRelationshipRepository = Depends(get_skill_repo),
    graph=Depends(get_graph_context_dep),
) -> SearchResponse:
    endpoint = "/search"
    try:
        outcome = await run_search(body, freelancer_repo, skill_relationship_repo, graph=graph)
        retrieval, candidates = outcome.retrieval, outcome.candidates
        reranked = await rerank_shortlist(
            outcome, body, freelancer_repo, ai_explanation_repo, use_llm=body.rerank
        )
        shown = reranked.candidates[:RESULT_LIMIT]
        top = [c.ranked for c in shown]

        explanation_struct = await explain_search(
            SearchExplanationInput(
                query=body.query,
                required_skills=body.skills,
                budget=body.budget,
                team_size=body.team_size,
                top_matches=top,
            )
        )
        explanation = explanation_struct.text

        # The search-history row doubles as the /search activity record.
        await search_history_repo.insert(
            query=body.query,
            skills=body.skills,
            filters={
                "min_rate": body.min_rate,
                "max_rate": body.max_rate,
                "budget": body.budget,
                "team_size": body.team_size,
            },
            result_count=len(candidates),
            top_freelancer_ids=[m.candidate.id for m in top],
        )
        await ai_explanation_repo.insert(
            endpoint=endpoint,
            explanation=explanation,
            model=explanation_struct.model_name,
            system_prompt="search",
            user_prompt=body.query,
            metadata={
                "returned": len(top),
                "source": explanation_struct.source,
                "usage": explanation_struct.usage,
            },
        )

        return SearchResponse(
            freelancers=[c.to_api_dict() for c in shown],
            explanation=explanation,
            total_candidates=len(candidates),
            retrieval={"mode": retrieval.mode, "skill_filter": retrieval.skill_filter},
            reranking=reranked.meta(),
            graph=outcome.graph.meta(),
        )
    except Exception as exc:
        logger.exception("search failed")
        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(by_alias=True),
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Search failed") from exc


@router.get("/precomputed/{project_id}")
async def get_precomputed_results(
    project_id: int,
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
):
    """Matches computed in the background when the project was created."""
    latest = await ai_explanation_repo.get_latest(
        entity_id=project_id, entity_type="project", pipeline=PRECOMPUTED_PIPELINE
    )
    if latest is None:
        return {
            "precomputed": False,
            "project_id": project_id,
            "ranked_freelancers": [],
            "message": "No precomputed matches yet; run /search for live results.",
        }
    meta = latest["metadata"]
    return {
        "precomputed": True,
        "project_id": project_id,
        "computed_at": latest["ran_at"],
        "ranked_freelancers": meta.get("freelancers", []),
        "reranking": meta.get("reranking", {}),
        "retrieval": meta.get("retrieval", {}),
        "graph": meta.get("graph"),
        "total_candidates": meta.get("total_candidates", 0),
    }
