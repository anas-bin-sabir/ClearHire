from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db_session, get_freelancer_repo
from app.db.repositories.postgres import FreelancerRepository
from app.core.rate_limit import enforce_public_rate_limit
from app.graph.explore import NotFound, explore
from app.models.orm import User
from app.models.schemas import GraphResponse

router = APIRouter(dependencies=[Depends(enforce_public_rate_limit)])


@router.get("", response_model=GraphResponse)
async def skill_graph(
    limit: int = Query(default=30, ge=1, le=200),
    freelancer_id: int | None = Query(default=None, gt=0),
    project_id: int | None = Query(default=None, gt=0),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> GraphResponse:
    """Graph for the admin page and a freelancer's own skill graph, from Neo4j when
    enabled (else Postgres).

    Admins may request any view. Everyone else may only request ``freelancer_id``
    for the profile linked to their account, and sees no other freelancer's fraud score.

    No focus: a sample of freelancers with their skills and RELATED_TO edges.
    ``freelancer_id``: skills (+1-hop related), projects, clients, collaborators.
    ``project_id``: required skills (+1-hop related), client, workers, best-matching
    freelancers and collaborations among them. ``limit`` caps each neighbour list.
    """
    if freelancer_id is not None and project_id is not None:
        raise HTTPException(status_code=422, detail="Pass freelancer_id or project_id, not both")
    is_admin = user.role == "admin"
    if not is_admin:
        own = await freelancer_repo.get_by_id(freelancer_id) if freelancer_id is not None else None
        if own is None or own.user_id is None or own.user_id != user.id:
            raise HTTPException(status_code=403, detail="You can only view your own skill graph")
    try:
        data = await explore(
            session, freelancer_id=freelancer_id, project_id=project_id, limit=limit
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    graph = GraphResponse.model_validate(data)
    if not is_admin:
        self_id = f"f-{freelancer_id}"
        for node in graph.nodes:
            if node.type == "freelancer" and node.id != self_id:
                node.fraud_score = None
    return graph
