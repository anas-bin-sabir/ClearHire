from fastapi import APIRouter, Depends, HTTPException

from app.ai.astar import rank_freelancers
from app.ai.explainer import explain_search
from app.ai.types import FreelancerCandidate, ProjectConstraints, SearchExplanationInput
from app.core.activity import log_activity
from app.core.config import settings
from app.core.dependencies import (
    get_ai_explanation_repo,
    get_freelancer_repo,
    get_search_history_repo,
)
from app.db.repositories.mongo import AIExplanationRepository, SearchHistoryRepository
from app.db.repositories.postgres import FreelancerRepository
from app.models.schemas import SearchRequest, SearchResponse

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search_freelancers(
    body: SearchRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    search_history_repo: SearchHistoryRepository = Depends(get_search_history_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> SearchResponse:
    endpoint = "/search"
    try:
        freelancers = await freelancer_repo.list_available(max_fraud_score=body.max_fraud)
        candidate_dicts = await freelancer_repo.to_ranked_dicts(freelancers)
        candidate_dicts = await freelancer_repo.filter_dicts(
            candidate_dicts,
            skills=body.skills or None,
            min_rate=body.min_rate,
            max_rate=body.max_rate,
            min_rating=body.min_rating,
            available_only=body.available_only,
            max_fraud=body.max_fraud,
        )

        candidates = [FreelancerCandidate.from_dict(c) for c in candidate_dicts]
        project = ProjectConstraints(
            required_skills=body.skills,
            budget=body.budget,
            team_size=body.team_size,
            hours_per_engagement=40.0,
        )
        ranking = rank_freelancers(candidates, project)
        top = ranking.ranked[:20]

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
            model=settings.anthropic_model,
            system_prompt="search",
            user_prompt=body.query,
            metadata={
                "returned": len(top),
                "source": explanation_struct.source,
            },
        )

        response = SearchResponse(
            freelancers=[m.to_api_dict() for m in top],
            explanation=explanation,
            total_candidates=len(candidates),
        )

        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(by_alias=True),
            response_summary={
                "total_candidates": len(candidates),
                "returned": len(top),
            },
        )
        return response
    except Exception as exc:
        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(by_alias=True),
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/precomputed/{project_id}")
async def get_precomputed_results(project_id: int):
    """
    Returns pre-ranked freelancers cached by the matching agent when
    the project was created. Frontend calls this on page load —
    if precomputed is True, results are shown without a manual search.
    """
    from app.db import mongodb as mongo_db
    db = mongo_db.get_database()
    doc = await db[mongo_db.COLLECTION_SEARCH_HISTORY].find_one(
        {"project_id": project_id, "pipeline": "matching"},
        sort=[("ran_at", -1)],
    )
    if not doc:
        return {"precomputed": False, "project_id": project_id, "ranked_freelancers": []}
    doc.pop("_id", None)
    if "ran_at" in doc and hasattr(doc["ran_at"], "isoformat"):
        doc["ran_at"] = doc["ran_at"].isoformat()
    return {
        "precomputed": True,
        "project_id": project_id,
        "ranked_freelancers": doc.get("ranked_freelancers", []),
        "total_candidates": doc.get("total_candidates", 0),
        "ran_at": doc.get("ran_at"),
    }


@router.get("/agent-status/{entity_type}/{entity_id}")
async def get_agent_status(entity_type: str, entity_id: int):
    """
    Returns latest agent run metadata for a freelancer or project.
    Used by AgentStatusBadge component on the frontend.
    entity_type: "freelancer" or "project"
    """
    from app.db import mongodb as mongo_db
    db = mongo_db.get_database()
    doc = await db[mongo_db.COLLECTION_AI_EXPLANATIONS].find_one(
        {"entity_id": entity_id, "entity_type": entity_type},
        sort=[("ran_at", -1)],
    )
    if not doc:
        return {"ran": False, "entity_id": entity_id, "entity_type": entity_type}
    doc.pop("_id", None)
    if "ran_at" in doc and hasattr(doc["ran_at"], "isoformat"):
        doc["ran_at"] = doc["ran_at"].isoformat()
    return {
        "ran": True,
        "pipeline": doc.get("pipeline"),
        "ran_at": doc.get("ran_at"),
        "triggered_by": doc.get("triggered_by"),
        "entity_id": entity_id,
        "entity_type": entity_type,
        "metadata": doc.get("metadata", {}),
    }
