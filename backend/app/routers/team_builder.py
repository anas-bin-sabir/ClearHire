from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.ai.team_solver import solve_team
from app.ai.explainer import explain_team
from app.ai.types import FreelancerCandidate, TeamBuilderConstraints, TeamExplanationInput
from app.core.activity import log_activity
from app.core.dependencies import get_ai_explanation_repo, get_freelancer_repo
from app.core.rate_limit import enforce_public_rate_limit, enforce_user_action_rate_limit
from app.db.repositories.postgres import AIExplanationRepository, FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import TeamBuilderRequest, TeamBuilderResponse

router = APIRouter()


@router.get(
    "/status/{project_id}",
    dependencies=[Depends(enforce_public_rate_limit)],
)
async def get_team_build_status(
    project_id: int,
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> dict[str, Any]:
    """Poll background CSP agent result for a project."""
    cached = await ai_explanation_repo.get_latest(
        entity_id=project_id,
        pipeline="csp_team_builder",
    )
    if not cached:
        return {"status": "pending", "project_id": project_id}
    return {"status": "complete", "project_id": project_id, **cached}


@router.post(
    "",
    response_model=TeamBuilderResponse,
    dependencies=[Depends(enforce_user_action_rate_limit)],
)
async def build_team(
    body: TeamBuilderRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> TeamBuilderResponse:
    endpoint = "/team-builder"
    try:
        freelancers_orm = await freelancer_repo.list_for_team_building(
            max_fraud_score=body.max_fraud_score
        )
        candidates = [
            FreelancerCandidate.from_dict(freelancer_to_dict(f))
            for f in freelancers_orm
        ]

        constraints = TeamBuilderConstraints(
            budget=body.budget,
            required_skills=body.required_skills,
            team_size=body.team_size,
            hours_per_member=body.hours_per_member,
            max_fraud_score=body.max_fraud_score,
        )
        csp_result = solve_team(candidates, constraints)

        explanation_struct = await explain_team(
            TeamExplanationInput(constraints=constraints, result=csp_result)
        )
        explanation = explanation_struct.text

        if csp_result.solved:
            response = TeamBuilderResponse(
                success=True,
                team=csp_result.team_as_dicts(),
                total_cost=csp_result.total_cost,
                explanation=explanation,
                message=csp_result.message,
                backtracks=csp_result.stats.backtracks,
                nodes_explored=csp_result.stats.nodes_explored,
            )
        else:
            response = TeamBuilderResponse(
                success=False,
                team=[],
                total_cost=0.0,
                explanation=explanation,
                message=csp_result.message,
                backtracks=csp_result.stats.backtracks,
                nodes_explored=csp_result.stats.nodes_explored,
            )

        await ai_explanation_repo.insert(
            endpoint=endpoint,
            explanation=explanation,
            model=explanation_struct.model_name,
            system_prompt="team-builder",
            user_prompt=",".join(body.required_skills),
            entity_id=body.project_id,
            entity_type="project",
            pipeline="csp_team_builder",
            metadata={
                "success": response.success,
                "team_size": len(response.team),
                "source": explanation_struct.source,
                "usage": explanation_struct.usage,
            },
        )

        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(),
            response_summary={
                "success": response.success,
                "team_size": len(response.team),
                "team_ids": [m.get("id") for m in response.team if isinstance(m, dict)],
                "total_cost": response.total_cost,
            },
        )
        return response
    except Exception as exc:
        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(),
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc
