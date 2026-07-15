import logging

from fastapi import APIRouter, Depends, HTTPException

from app.ai.explainer import explain_search
from app.ai.types import SearchExplanationInput
from app.core.activity import log_activity
from app.core.dependencies import (
    get_ai_explanation_repo,
    get_freelancer_repo,
    get_search_history_repo,
    get_skill_repo,
)
from app.core.rate_limit import enforce_public_rate_limit
from app.core.search_pipeline import RESULT_LIMIT, run_search
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
) -> SearchResponse:
    endpoint = "/search"
    try:
        outcome = await run_search(body, freelancer_repo, skill_relationship_repo)
        retrieval, candidates = outcome.retrieval, outcome.candidates
        top = outcome.ranked[:RESULT_LIMIT]

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
            freelancers=[m.to_api_dict() for m in top],
            explanation=explanation,
            total_candidates=len(candidates),
            retrieval={"mode": retrieval.mode, "skill_filter": retrieval.skill_filter},
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
async def get_precomputed_results(project_id: int):
    """Placeholder until background matching lands (CURRENT.md Phase 3)."""
    return {
        "precomputed": False,
        "project_id": project_id,
        "ranked_freelancers": [],
        "message": "Run /search for live results.",
    }
