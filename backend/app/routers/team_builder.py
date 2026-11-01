import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.ai.team_solver import solve_team
from app.ai.explainer import explain_team
from app.ai.types import FreelancerCandidate, TeamBuilderConstraints, TeamExplanationInput
from app.core.activity import log_activity
from app.core.dependencies import (
    get_ai_explanation_repo,
    get_freelancer_repo,
    get_graph_context_dep,
)
from app.core.rate_limit import enforce_public_rate_limit, enforce_user_action_rate_limit
from app.db.repositories.postgres import AIExplanationRepository, FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import TeamBuilderRequest, TeamBuilderResponse, TeamCollaboration

logger = logging.getLogger(__name__)

router = APIRouter()


async def team_collaborations(
    graph, team: list[FreelancerCandidate], required_skills: list[str],
    freelancer_repo: FreelancerRepository,
) -> tuple[list[TeamCollaboration], str]:
    """COLLABORATED_WITH facts among the chosen members, one entry per pair."""
    if graph is None:
        return [], "off"
    if len(team) < 2:
        return [], graph.source
    ids = [m.id for m in team]
    names = {m.id: m.name for m in team}
    try:
        subgraphs = await graph.candidate_subgraph(ids, required_skills)
    except Exception as exc:  # noqa: BLE001 - explanation degrades, team stands
        logger.warning("team collaborations via %s failed: %s", graph.source, exc)
        return [], "error"
    titles: dict[int, str] = {}
    for projects in (await freelancer_repo.completed_projects_for(ids, per_freelancer=50)).values():
        titles.update(dict(projects))
    pairs: dict[tuple[int, int], TeamCollaboration] = {}
    for fid, sub in subgraphs.items():
        for c in sub.collaborations:
            if c.other_id not in names or fid not in names or c.other_id == fid:
                continue
            a, b = sorted((fid, c.other_id))
            if (a, b) in pairs:
                continue
            pairs[(a, b)] = TeamCollaboration(
                a_id=a, a_name=names[a], b_id=b, b_name=names[b],
                project_ids=sorted(c.project_ids),
                project_titles=[titles[p] for p in sorted(c.project_ids) if p in titles],
                count=c.count,
                avg_rating=None if c.avg_rating is None else round(c.avg_rating, 2),
            )
    ordered = sorted(pairs.values(), key=lambda x: (-x.count, x.a_id, x.b_id))
    return ordered, graph.source


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
    graph=Depends(get_graph_context_dep),
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

        collaborations, graph_source = (
            await team_collaborations(
                graph, csp_result.team, body.required_skills, freelancer_repo
            )
            if csp_result.solved
            else ([], graph.source if graph is not None else "off")
        )
        explanation_struct = await explain_team(
            TeamExplanationInput(constraints=constraints, result=csp_result),
            collaborations=[c.model_dump() for c in collaborations],
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
                collaborations=collaborations,
                graph_source=graph_source,
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
                graph_source=graph_source,
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
                "collaborations": [c.model_dump() for c in collaborations],
                "graph_source": graph_source,
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
