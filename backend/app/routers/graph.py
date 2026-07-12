from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_freelancer_repo, get_skill_repo, require_admin
from app.core.rate_limit import enforce_public_rate_limit
from app.db.repositories.postgres import FreelancerRepository, SkillRelationshipRepository
from app.models.schemas import GraphLink, GraphNode, GraphResponse

router = APIRouter(
    dependencies=[Depends(enforce_public_rate_limit), Depends(require_admin)]
)


@router.get("", response_model=GraphResponse)
async def skill_graph(
    limit: int = Query(default=30, ge=1, le=200),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    skill_repo: SkillRelationshipRepository = Depends(get_skill_repo),
) -> GraphResponse:
    """Freelancer→skill graph built from PostgreSQL (Neo4j-backed in Phase 4)."""
    nodes: dict[str, GraphNode] = {}
    links: list[GraphLink] = []

    for fid, name, skills, fraud_score in await freelancer_repo.list_graph_preview(limit):
        node_id = f"f-{fid}"
        nodes[node_id] = GraphNode(
            id=node_id, name=name, type="freelancer", fraud_score=fraud_score
        )
        for skill in skills:
            skill_id = f"s-{skill}"
            nodes.setdefault(skill_id, GraphNode(id=skill_id, name=skill, type="skill"))
            links.append(GraphLink(source=node_id, target=skill_id, type="HAS_SKILL"))

    for rel in await skill_repo.list_all():
        a, b = f"s-{rel.skill_a}", f"s-{rel.skill_b}"
        if a in nodes and b in nodes:
            links.append(GraphLink(source=a, target=b, type="RELATED_TO"))

    return GraphResponse(nodes=list(nodes.values()), links=links, source="postgres")
