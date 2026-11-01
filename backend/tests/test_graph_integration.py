"""Phase 4 GraphRAG integration: retrieval/ranking expansion, graph evidence in the
rerank, team collaborations, and GET /graph subgraphs (Postgres and Neo4j).

Everything except the ``neo4j_graph`` tests runs with Neo4j disabled, i.e. on the
Postgres GraphContext; those tests skip when TEST_NEO4J_URI is unreachable.
"""

from app.core.search_pipeline import run_search
from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    SkillRelationshipRepository,
)
from app.db.session import async_session_factory
from app.graph.context import CandidateGraph
from app.models.schemas import SearchRequest
from tests.conftest import TEST_NEO4J_URI


class FakeGraph:
    """Minimal GraphContext: fixed expansion and subgraphs, optional failure."""

    source = "postgres"

    def __init__(self, expansion=None, subgraphs=None, fail=False):
        self.expansion = expansion or {}
        self.subgraphs = subgraphs or {}
        self.fail = fail
        self.expand_calls: list[list[str]] = []

    async def expand_skills(self, skills, *, hops=None, decay=None):
        self.expand_calls.append(list(skills))
        if self.fail:
            raise RuntimeError("graph down")
        return {s.lower(): self.expansion.get(s.lower(), {}) for s in skills}

    async def candidate_subgraph(self, ids, required_skills, *, max_paths=6, max_projects=3):
        if self.fail:
            raise RuntimeError("graph down")
        return {i: self.subgraphs.get(i, CandidateGraph(freelancer_id=i)) for i in ids}


async def _search(body: dict, graph=None):
    async with async_session_factory() as session:
        return await run_search(
            SearchRequest.model_validate(body),
            FreelancerRepository(session),
            SkillRelationshipRepository(session),
            graph=graph,
        )


async def _completed(freelancer_id: int, project_id: int) -> None:
    async with async_session_factory() as session:
        await ContractRepository(session).create(
            freelancer_id=freelancer_id, project_id=project_id, status="completed"
        )
        await session.commit()


async def _world(make_user, make_freelancer, make_project):
    """Kube and Dock shipped "Cluster migration" together; Figma is unrelated."""
    client_user, _ = await make_user("client")
    kube = await make_freelancer(name="Kube", skills=["Kubernetes"], bio="Runs clusters",
                                 rating=4.8, fraud_score=0.1)
    dock = await make_freelancer(name="Dock", skills=["Docker"], bio="Containers",
                                 rating=4.6, fraud_score=0.2)
    figma = await make_freelancer(name="Figma", skills=["Figma"], bio="Designs apps")
    project = await make_project(client_user.id, title="Cluster migration",
                                 required_skills=["Kubernetes", "Docker"])
    await _completed(kube.id, project.id)
    await _completed(dock.id, project.id)
    return kube, dock, figma, project, client_user


# --- retrieval and ranking ---------------------------------------------------


async def test_pipeline_ranks_with_graph_expansion(make_freelancer):
    # "Nomad" has no curated edge to Kubernetes; only the graph knows they're related.
    nomad = await make_freelancer(name="Nomad", skills=["Nomad"])
    await make_freelancer(name="Figma", skills=["Figma"])
    body = {"query": "orchestration", "skills": ["Kubernetes"]}

    off = await _search(body)
    graph = FakeGraph(expansion={"kubernetes": {"nomad": 0.6}})
    on = await _search(body, graph)

    assert off.graph.source == "off"
    assert on.graph.source == "postgres"
    assert on.graph.expanded_skills == {"kubernetes": {"nomad": 0.6}}
    assert graph.expand_calls == [["Kubernetes"]]
    by_name = {r.candidate.name: r for r in on.ranked}
    assert by_name["Nomad"].breakdown.adjacent_skills == {"Kubernetes": "Nomad"}
    assert by_name["Nomad"].rank == 1
    off_nomad = next(r for r in off.ranked if r.candidate.id == nomad.id)
    assert off_nomad.breakdown.missing_skills == ["Kubernetes"]
    assert by_name["Nomad"].rank_score > off_nomad.rank_score
    # Retrieval: the Nomad holder came in through the widened filter.
    labels = {c.freelancer.name: c.skill_filter for c in on.retrieval.candidates}
    assert labels["Nomad"] == "expanded" and labels["Figma"] == "relaxed"


async def test_graph_failure_falls_back_to_curated_adjacency(make_freelancer):
    await make_freelancer(name="Dock", skills=["Docker"])
    outcome = await _search({"query": "k8s", "skills": ["Kubernetes"]}, FakeGraph(fail=True))
    assert outcome.graph.source == "error" and outcome.graph.error == "graph down"
    # skill_relationships still gives Docker partial credit.
    assert outcome.ranked[0].breakdown.adjacent_skills == {"Kubernetes": "Docker"}


async def _retrieve(query, **kwargs):
    async with async_session_factory() as session:
        result = await FreelancerRepository(session).hybrid_retrieve(query, **kwargs)
        return result, [c.freelancer.name for c in result.candidates]


async def test_relaxed_pass_prefers_related_skill_holders(make_freelancer):
    # The bio-matching designer wins on keywords; the Docker holder has a related skill.
    await make_freelancer(name="Talker", skills=["Figma"], bio="kubernetes kubernetes clusters")
    await make_freelancer(name="Dock", skills=["Docker"], bio="containers and clusters")
    await make_freelancer(name="Weak", skills=["Bash"], bio="scripts")
    common = dict(must_skills=["Kubernetes"], mode="keyword", min_results=5)

    result, names = await _retrieve("kubernetes clusters", limit=1, **common)
    assert names == ["Talker"] and result.skill_filter == "relaxed"

    expanded = {"docker": 0.6, "bash": 0.1}  # bash is below the widening threshold
    result, names = await _retrieve(
        "kubernetes clusters", limit=1, expanded_skills=expanded, **common
    )
    assert names == ["Dock"] and result.skill_filter == "expanded"
    assert result.candidates[0].graph_affinity == 0.6

    # With room left, the relaxed pass still tops the shortlist up afterwards.
    result, names = await _retrieve(
        "kubernetes clusters", limit=5, expanded_skills=expanded, **common
    )
    assert names[0] == "Dock" and "Talker" in names
    assert result.skill_filter == "relaxed"
    assert [c.skill_filter for c in result.candidates][0] == "expanded"


async def test_expanded_pass_without_a_query_orders_by_affinity(make_freelancer):
    await make_freelancer(name="Top rated", skills=["Figma"], rating=5.0)
    await make_freelancer(name="Weak link", skills=["Linux"], rating=3.0)
    await make_freelancer(name="Strong link", skills=["Docker"], rating=3.0)
    _, names = await _retrieve(
        None, must_skills=["Kubernetes"], expanded_skills={"docker": 0.6, "linux": 0.3},
        min_results=5, limit=3,
    )
    assert names == ["Strong link", "Weak link", "Top rated"]


# --- /search with the real Postgres GraphContext ------------------------------


async def test_search_reports_graph_and_cites_graph_facts(
    client, make_user, make_freelancer, make_project
):
    kube, dock, _, project, _ = await _world(make_user, make_freelancer, make_project)
    body = (await client.post("/search", json={"query": "kubernetes",
                                               "skills": ["Kubernetes"]})).json()
    assert body["graph"]["source"] == "postgres"
    assert body["graph"]["expanded_skills"]["kubernetes"]["docker"] > 0
    assert body["reranking"]["path"] == "deterministic"
    results = {r["name"]: r for r in body["freelancers"]}

    dock_refs = [ref for c in results["Dock"]["reasoning"]["strengths"] for ref in c["evidence"]]
    assert f"f{dock.id}.graph:path:Kubernetes" in dock_refs
    assert results["Dock"]["graph"]["skill_paths"][0]["path"] == ["Docker", "Kubernetes"]

    kube_claims = results["Kube"]["reasoning"]["strengths"]
    collab = next(c for c in kube_claims if f"f{kube.id}.graph:collab:{dock.id}" in c["evidence"])
    assert "Cluster migration" in collab["text"] and "Dock" in collab["text"]
    assert f"f{kube.id}.project:{project.id}" in collab["evidence"]


async def test_precomputed_matches_record_the_graph_source(client, make_user, make_freelancer):
    await make_freelancer(name="Dock", skills=["Docker"])
    _, headers = await make_user("client")
    created = await client.post(
        "/projects",
        json={"title": "Kubernetes platform", "required_skills": ["Kubernetes"],
              "budget": 8000, "deadline_days": 30, "team_size": 1},
        headers=headers,
    )
    project_id = created.json()["project"]["id"]
    body = (await client.get(f"/search/precomputed/{project_id}")).json()
    assert body["graph"]["source"] == "postgres"


# --- team builder --------------------------------------------------------------


async def test_team_explanation_uses_member_collaborations(
    client, make_user, make_freelancer, make_project
):
    kube, dock, _, project, _ = await _world(make_user, make_freelancer, make_project)
    response = await client.post(
        "/team-builder",
        json={"budget": 100_000, "required_skills": ["Kubernetes", "Docker"], "team_size": 2},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] and {m["id"] for m in body["team"]} == {kube.id, dock.id}
    assert body["graph_source"] == "postgres"
    [collab] = body["collaborations"]
    assert {k: v for k, v in collab.items() if k != "avg_rating"} == {
        "a_id": kube.id, "a_name": "Kube", "b_id": dock.id, "b_name": "Dock",
        "project_ids": [project.id], "project_titles": ["Cluster migration"], "count": 1,
    }
    assert "Kube and Dock completed 'Cluster migration' together" in body["explanation"]


# --- GET /graph ------------------------------------------------------------------


def _links(body, type_):
    return {(l["source"], l["target"]) for l in body["links"] if l["type"] == type_}


async def test_graph_endpoint_is_admin_only(client, make_user, make_freelancer):
    freelancer = await make_freelancer()
    _, client_headers = await make_user("client")
    url = f"/graph?freelancer_id={freelancer.id}"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=client_headers)).status_code == 403


async def test_freelancer_can_view_only_their_own_graph(client, make_user, make_freelancer, make_project):
    kube, dock, _, project, client_user = await _world(make_user, make_freelancer, make_project)
    worker, worker_headers = await make_user("freelancer")
    mine = await make_freelancer(name="Mine", user_id=worker.id, skills=["Kubernetes"])

    own = await client.get(f"/graph?freelancer_id={mine.id}", headers=worker_headers)
    assert own.status_code == 200, own.text
    assert own.json()["focus"] == f"f-{mine.id}"

    # Not someone else's graph, not the overview, not a project view.
    assert (await client.get(f"/graph?freelancer_id={kube.id}", headers=worker_headers)).status_code == 403
    assert (await client.get("/graph", headers=worker_headers)).status_code == 403
    assert (await client.get(f"/graph?project_id={project.id}", headers=worker_headers)).status_code == 403


async def test_own_graph_hides_other_freelancers_fraud_scores(client, make_user, make_freelancer, make_project):
    kube, dock, _, project, client_user = await _world(make_user, make_freelancer, make_project)
    linked_user, linked_headers = await make_user("freelancer")
    # Link an existing freelancer from the shared world, so collaborators appear.
    async with async_session_factory() as session:
        await FreelancerRepository(session).update(kube.id, {"user_id": linked_user.id})
        await session.commit()

    body = (await client.get(f"/graph?freelancer_id={kube.id}", headers=linked_headers)).json()
    others = [n for n in body["nodes"] if n["type"] == "freelancer" and n["id"] != f"f-{kube.id}"]
    assert others, "expected Dock as a collaborator node"
    assert all(n["fraud_score"] is None for n in others)


async def test_graph_around_a_freelancer(client, make_user, make_freelancer, make_project):
    kube, dock, _, project, client_user = await _world(make_user, make_freelancer, make_project)
    _, admin = await make_user("admin")
    response = await client.get(f"/graph?freelancer_id={kube.id}", headers=admin)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "postgres" and body["focus"] == f"f-{kube.id}"
    nodes = {n["id"]: n for n in body["nodes"]}
    assert nodes[f"f-{kube.id}"]["fraud_score"] == 0.1
    assert nodes[f"f-{dock.id}"]["fraud_score"] == 0.2
    assert nodes[f"p-{project.id}"]["type"] == "project"
    assert nodes[f"c-{client_user.id}"]["type"] == "client"
    assert (f"f-{kube.id}", "s-Kubernetes") in _links(body, "HAS_SKILL")
    assert ("s-Docker", "s-Kubernetes") in _links(body, "RELATED_TO")
    assert (f"f-{kube.id}", f"p-{project.id}") in _links(body, "WORKED_ON")
    assert (f"f-{dock.id}", f"p-{project.id}") in _links(body, "WORKED_ON")
    assert (f"c-{client_user.id}", f"p-{project.id}") in _links(body, "POSTED")
    collab = next(l for l in body["links"] if l["type"] == "COLLABORATED_WITH")
    assert {collab["source"], collab["target"]} == {f"f-{kube.id}", f"f-{dock.id}"}
    assert collab["properties"]["count"] == 1
    assert collab["properties"]["project_ids"] == [project.id]


async def test_graph_around_a_project(client, make_user, make_freelancer, make_project):
    kube, dock, figma, project, _ = await _world(make_user, make_freelancer, make_project)
    _, admin = await make_user("admin")
    body = (await client.get(f"/graph?project_id={project.id}", headers=admin)).json()
    assert body["focus"] == f"p-{project.id}"
    requires = {l["target"]: l["properties"]["importance"]
                for l in body["links"] if l["type"] == "REQUIRES"}
    assert requires == {"s-Kubernetes": "must", "s-Docker": "must"}
    assert {(f"f-{kube.id}", f"p-{project.id}"), (f"f-{dock.id}", f"p-{project.id}")} <= _links(
        body, "WORKED_ON"
    )
    assert len(_links(body, "COLLABORATED_WITH")) == 1
    assert f"f-{figma.id}" not in {n["id"] for n in body["nodes"]}


async def test_graph_focus_errors(client, make_user):
    _, admin = await make_user("admin")
    assert (await client.get("/graph?freelancer_id=999", headers=admin)).status_code == 404
    assert (await client.get("/graph?project_id=999", headers=admin)).status_code == 404
    both = await client.get("/graph?freelancer_id=1&project_id=1", headers=admin)
    assert both.status_code == 422


# --- Neo4j backend -------------------------------------------------------------


async def _rebuild_neo4j():
    from app.graph import sync

    async with async_session_factory() as session:
        await sync.full_rebuild(session)
        await session.commit()


def _shape(body):
    return (
        {n["id"]: (n["type"], n.get("fraud_score")) for n in body["nodes"]},
        {(l["type"], l["source"], l["target"]) for l in body["links"]},
    )


async def test_neo4j_graph_matches_postgres(
    neo4j_graph, client, make_user, make_freelancer, make_project, monkeypatch
):
    from app.core.config import settings

    kube, dock, _, project, _ = await _world(make_user, make_freelancer, make_project)
    _, admin = await make_user("admin")
    await _rebuild_neo4j()

    for query in (f"freelancer_id={kube.id}", f"project_id={project.id}"):
        neo = (await client.get(f"/graph?{query}", headers=admin)).json()
        assert neo["source"] == "neo4j", query
        monkeypatch.setattr(settings, "neo4j_uri", "")
        pg = (await client.get(f"/graph?{query}", headers=admin)).json()
        monkeypatch.setattr(settings, "neo4j_uri", TEST_NEO4J_URI)
        assert pg["source"] == "postgres"
        assert _shape(neo) == _shape(pg), query


async def test_search_and_team_use_neo4j_when_enabled(
    neo4j_graph, client, make_user, make_freelancer, make_project
):
    kube, dock, _, _, _ = await _world(make_user, make_freelancer, make_project)
    await _rebuild_neo4j()
    body = (await client.post("/search", json={"query": "kubernetes",
                                               "skills": ["Kubernetes"]})).json()
    assert body["graph"]["source"] == "neo4j"
    kube_refs = [ref for r in body["freelancers"] if r["id"] == kube.id
                 for c in r["reasoning"]["strengths"] for ref in c["evidence"]]
    assert f"f{kube.id}.graph:collab:{dock.id}" in kube_refs
    team = (await client.post(
        "/team-builder",
        json={"budget": 100_000, "required_skills": ["Kubernetes", "Docker"], "team_size": 2},
    )).json()
    assert team["graph_source"] == "neo4j"
    assert [c["count"] for c in team["collaborations"]] == [1]



async def test_neo4j_failure_mid_request_retries_on_postgres(
    neo4j_graph, client, make_user, make_freelancer, make_project, monkeypatch
):
    from app.graph.neo4j_context import Neo4jGraphContext

    kube, dock, _, _, _ = await _world(make_user, make_freelancer, make_project)

    async def boom(self, *args, **kwargs):
        raise RuntimeError("neo4j went away")

    monkeypatch.setattr(Neo4jGraphContext, "expand_skills", boom)
    monkeypatch.setattr(Neo4jGraphContext, "candidate_subgraph", boom)
    body = (await client.post("/search", json={"query": "kubernetes",
                                               "skills": ["Kubernetes"]})).json()
    assert body["graph"]["source"] == "postgres"
    assert body["graph"]["expanded_skills"]["kubernetes"]["docker"] > 0
    team = (await client.post(
        "/team-builder",
        json={"budget": 100_000, "required_skills": ["Kubernetes", "Docker"], "team_size": 2},
    )).json()
    assert team["graph_source"] == "postgres" and len(team["collaborations"]) == 1
