from fastapi import APIRouter, Depends, HTTPException

from app.core.activity import log_activity
from app.core.dependencies import get_freelancer_repo, get_graph_repo, get_skill_repo
from app.db.repositories.neo4j import GraphRepository
from app.db.repositories.postgres import FreelancerRepository, SkillRelationshipRepository
from app.models.schemas import GraphNode, GraphResponse

router = APIRouter()


def _enrich_fraud_scores(
    response: GraphResponse, fraud_by_id: dict[int, float]
) -> GraphResponse:
    nodes: list[GraphNode] = []
    for node in response.nodes:
        if node.type != "freelancer":
            nodes.append(node)
            continue
        fid: int | None = None
        if node.id.startswith("f-"):
            try:
                fid = int(node.id[2:])
            except ValueError:
                pass
        fraud = fraud_by_id.get(fid) if fid is not None else None
        nodes.append(
            GraphNode(
                id=node.id,
                name=node.name,
                type=node.type,
                fraud_score=fraud if fraud is not None else node.fraud_score,
            )
        )
    return GraphResponse(nodes=nodes, links=response.links, source=response.source)


@router.get("", response_model=GraphResponse)
async def get_graph(
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    skill_repo: SkillRelationshipRepository = Depends(get_skill_repo),
    graph_repo: GraphRepository = Depends(get_graph_repo),
) -> GraphResponse:
    endpoint = "/graph"
    try:
        pg_freelancers = await freelancer_repo.list_graph_preview(limit=40)
        fraud_by_id = {fid: fraud for fid, _name, _skills, fraud in pg_freelancers}
        pg_skills = await skill_repo.list_all()
        pg_skill_pairs = [(r.skill_a, r.skill_b) for r in pg_skills]

        response: GraphResponse | None = None
        try:
            neo = await graph_repo.fetch_full_graph(limit=40)
            if neo.nodes:
                response = _enrich_fraud_scores(neo, fraud_by_id)
        except Exception:
            response = None

        if response is None or not response.nodes:
            neo4j_edges: list = []
            try:
                neo4j_edges = await graph_repo.fetch_related_skill_edges()
            except Exception:
                pass
            response = GraphRepository.merge_postgres_graph(
                pg_freelancers,
                pg_skill_pairs,
                neo4j_edges,
            )

        await log_activity(
            endpoint=endpoint,
            method="GET",
            payload={},
            response_summary={
                "nodes": len(response.nodes),
                "links": len(response.links),
                "source": response.source,
            },
        )
        return response
    except Exception as exc:
        await log_activity(
            endpoint=endpoint,
            method="GET",
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc
