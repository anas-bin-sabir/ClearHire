"""GraphRAG context: Postgres CTE backend, Neo4j backend parity, ontology edges."""

from __future__ import annotations

import pytest
from sqlalchemy import select, text

from app.ai.skill_taxonomy import (
    CANONICAL_NAMES,
    CATEGORY_EDGE_WEIGHT_BAND,
    RELATED_SKILLS,
    category_edges,
    related_skill_map,
)
from app.core.config import settings
from app.db.repositories.postgres import SkillRelationshipRepository
from app.db.repositories.postgres.contract_repository import ContractRepository
from app.db.session import async_session_factory
from app.graph import driver as graph_driver
from app.graph import model
from app.graph.context import CandidateGraph, SkillPath, get_graph_context
from app.graph.neo4j_context import Neo4jGraphContext
from app.graph.postgres_context import PostgresGraphContext
from app.models.orm import SkillRelationship

# A private skill graph (names never collide with the taxonomy):
#
#   GxA -0.8- GxB -0.9- GxD        GxE -0.5- GxF -0.5- GxG -0.5- GxH
#     \        |      /
#      0.3    0.6   0.1 (GxA-GxD)
#        \     |
#          GxC
FAKE_EDGES = [
    ("GxA", "GxB", 0.8),
    ("GxB", "GxC", 0.6),
    ("GxC", "GxA", 0.3),  # closes the A-B-C cycle
    ("GxA", "GxD", 0.1),
    ("GxB", "GxD", 0.9),
    ("GxE", "GxF", 0.5),
    ("GxF", "GxG", 0.5),
    ("GxG", "GxH", 0.5),
]


@pytest.fixture
async def fake_edges():
    """Insert FAKE_EDGES into skill_relationships (reference data, not truncated)."""
    async with async_session_factory() as session:
        await session.execute(text("DELETE FROM skill_relationships WHERE skill_a LIKE 'Gx%'"))
        for a, b, w in FAKE_EDGES:
            session.add(SkillRelationship(skill_a=a, skill_b=b, weight=w))
        await session.commit()
    yield FAKE_EDGES
    async with async_session_factory() as session:
        await session.execute(text("DELETE FROM skill_relationships WHERE skill_a LIKE 'Gx%'"))
        await session.commit()


async def _contract(freelancer_id: int, project_id: int, status: str = model.COMPLETED) -> None:
    async with async_session_factory() as session:
        await ContractRepository(session).create(
            freelancer_id=freelancer_id, project_id=project_id, status=status
        )
        await session.commit()


@pytest.fixture
async def scenario(fake_edges, make_freelancer, make_project):
    """Freelancers, projects and contracts over the fake skill graph."""
    f1 = await make_freelancer(name="Ada", skills=["GxB", "Python"])
    f2 = await make_freelancer(name="Bo", skills=["GxC"])
    f3 = await make_freelancer(name="Cy", skills=["Figma"])
    f4 = await make_freelancer(name="Di", skills=["GxA"])
    p1 = await make_project(None, title="Alpha", required_skills=["GxA", "GxB"])
    p2 = await make_project(None, title="Beta", required_skills=["GxA"])
    p3 = await make_project(None, title="Gamma", required_skills=["Figma"])
    p4 = await make_project(None, title="Delta", required_skills=["GxA", "GxB", "GxD"])
    p5 = await make_project(None, title="Eps", required_skills=["GxD", "GxB"])
    await _contract(f1.id, p1.id)
    await _contract(f1.id, p2.id)
    await _contract(f1.id, p3.id)
    await _contract(f1.id, p4.id, status="active")  # not completed: ignored
    await _contract(f1.id, p5.id)
    await _contract(f2.id, p1.id)
    await _contract(f2.id, p2.id, status="cancelled")
    await _contract(f3.id, p2.id)
    await _contract(f4.id, p5.id)
    return {
        "f": [f1.id, f2.id, f3.id, f4.id],
        "p": [p1.id, p2.id, p3.id, p4.id, p5.id],
    }


async def _pg_expand(skills, **kwargs):
    async with async_session_factory() as session:
        return await PostgresGraphContext(session).expand_skills(skills, **kwargs)


async def _pg_subgraph(ids, required, **kwargs):
    async with async_session_factory() as session:
        return await PostgresGraphContext(session).candidate_subgraph(ids, required, **kwargs)


# ---------------------------------------------------------------------------
# Postgres backend: skill expansion
# ---------------------------------------------------------------------------


async def test_expand_one_hop_matches_edge_weights(fake_edges):
    result = await _pg_expand(["GxA"], hops=1, decay=0.5)
    assert result == {"gxa": {"gxb": 0.8, "gxc": 0.3, "gxd": 0.1}}


async def test_expand_two_hops_decays_and_best_path_wins(fake_edges):
    result = await _pg_expand(["GxA"], hops=2, decay=0.5)
    # GxB: direct 0.8 beats GxA-GxC-GxB (0.3*0.6*0.5). GxC: direct 0.3 beats 0.24.
    # GxD: GxA-GxB-GxD (0.8*0.9*0.5 = 0.36) beats the direct 0.1 edge.
    assert result["gxa"] == pytest.approx({"gxb": 0.8, "gxc": 0.3, "gxd": 0.36})
    assert "gxa" not in result["gxa"]  # cycle never returns to the start


async def test_expand_respects_hop_limit_and_settings_defaults(fake_edges, monkeypatch):
    chain = await _pg_expand(["GxE"], hops=3, decay=0.5)
    assert chain["gxe"] == pytest.approx({"gxf": 0.5, "gxg": 0.125, "gxh": 0.03125})
    monkeypatch.setattr(settings, "graph_expansion_hops", 2)
    monkeypatch.setattr(settings, "graph_expansion_decay", 1.0)
    defaults = await _pg_expand(["gxe"])  # lower-case input works too
    assert defaults["gxe"] == pytest.approx({"gxf": 0.5, "gxg": 0.25})


async def test_expand_unknown_skill_and_empty_input(fake_edges):
    assert await _pg_expand(["NoSuchSkillAnywhere"]) == {}
    assert await _pg_expand([]) == {}


async def test_expand_one_hop_equals_adjacency():
    """With hops=1 the expansion is exactly the ranking adjacency for those skills."""
    async with async_session_factory() as session:
        adjacency = await SkillRelationshipRepository(session).adjacency()
    skills = ["Python", "React", "Kubernetes", "PostgreSQL"]
    result = await _pg_expand(skills, hops=1)
    assert result == {s.lower(): adjacency[s.lower()] for s in skills}


# ---------------------------------------------------------------------------
# Postgres backend: candidate subgraph
# ---------------------------------------------------------------------------


async def test_subgraph_skill_paths(scenario):
    f1, f2, f3, _ = scenario["f"]
    graphs = await _pg_subgraph([f1, f2, f3, 999_999], ["GxA", "GxB", "GxD"])

    assert set(graphs) == {f1, f2, f3, 999_999}  # every id present
    assert graphs[999_999].is_empty()

    assert graphs[f1].skill_paths == [
        SkillPath("GxA", "GxB", 1, 0.8, ["GxB", "GxA"]),
        SkillPath("GxB", "GxB", 0, 1.0, ["GxB"]),  # has it: 0-hop
        SkillPath("GxD", "GxB", 1, 0.9, ["GxB", "GxD"]),
    ]
    a, b, d = graphs[f2].skill_paths
    assert (a.via, a.hops, a.path) == ("GxC", 1, ["GxC", "GxA"])
    assert a.weight == pytest.approx(0.3)  # direct beats GxC-GxB-GxA (0.24)
    assert (b.hops, b.path) == (1, ["GxC", "GxB"])
    assert (d.hops, d.path) == (2, ["GxC", "GxB", "GxD"])
    assert d.weight == pytest.approx(0.6 * 0.9 * 0.5)
    assert graphs[f3].skill_paths == []  # Figma is not connected


async def test_subgraph_max_paths(scenario):
    f1 = scenario["f"][0]
    graphs = await _pg_subgraph([f1], ["GxA", "GxB", "GxD"], max_paths=2)
    assert [p.required for p in graphs[f1].skill_paths] == ["GxA", "GxB"]


async def test_subgraph_past_projects_by_overlap(scenario):
    f1, f2, f3, _ = scenario["f"]
    p1, p2, p3, p4, p5 = scenario["p"]
    graphs = await _pg_subgraph([f1, f2, f3], ["GxA", "GxB", "GxD"])
    projects = graphs[f1].past_projects
    # p5 and p1 overlap 2 (newer first), p2 overlaps 1; p3 no overlap; p4 not completed.
    assert [p.id for p in projects] == [p5, p1, p2]
    assert projects[0].title == "Eps"
    assert projects[0].shared_skills == ["GxB", "GxD"]  # in the search's order
    assert projects[1].shared_skills == ["GxA", "GxB"]
    assert [p.id for p in graphs[f2].past_projects] == [p1]  # p2 was cancelled
    assert [p.id for p in graphs[f3].past_projects] == [p2]

    limited = await _pg_subgraph([f1], ["GxA", "GxB", "GxD"], max_projects=1)
    assert [p.id for p in limited[f1].past_projects] == [p5]


async def test_subgraph_collaborations_limited_to_shortlist(scenario):
    f1, f2, f3, f4 = scenario["f"]
    p1, p2, _, _, p5 = scenario["p"]

    graphs = await _pg_subgraph([f1, f2], ["GxA"])
    (collab,) = graphs[f1].collaborations
    assert (collab.other_id, collab.other_name, collab.project_ids, collab.count) == (
        f2, "Bo", [p1], 1,
    )
    assert collab.avg_rating is None  # contracts have no rating yet
    assert [c.other_id for c in graphs[f2].collaborations] == [f1]

    everyone = await _pg_subgraph([f1, f2, f3, f4], ["GxA"])
    assert [(c.other_id, c.project_ids) for c in everyone[f1].collaborations] == [
        (f2, [p1]), (f3, [p2]), (f4, [p5]),
    ]
    assert everyone[f4].collaborations[0].other_id == f1

    alone = await _pg_subgraph([f1], ["GxA"])
    assert alone[f1].collaborations == []


async def test_subgraph_no_required_skills_and_empty_shortlist(scenario):
    f1, f2, _, _ = scenario["f"]
    assert await _pg_subgraph([], ["GxA"]) == {}
    graphs = await _pg_subgraph([f1, f2], [])
    assert graphs[f1].skill_paths == [] and graphs[f1].past_projects == []
    assert len(graphs[f1].collaborations) == 1


# ---------------------------------------------------------------------------
# get_graph_context fallback
# ---------------------------------------------------------------------------


async def test_factory_uses_postgres_when_neo4j_disabled(monkeypatch):
    monkeypatch.setattr(settings, "neo4j_uri", "")
    await graph_driver.close_driver()
    async with async_session_factory() as session:
        ctx = await get_graph_context(session)
    assert isinstance(ctx, PostgresGraphContext) and ctx.source == "postgres"


async def test_factory_falls_back_when_neo4j_unreachable(monkeypatch):
    monkeypatch.setattr(settings, "neo4j_uri", "bolt://127.0.0.1:9")
    monkeypatch.setattr(settings, "neo4j_password", "nope")
    await graph_driver.close_driver()
    try:
        async with async_session_factory() as session:
            ctx = await get_graph_context(session)
        assert isinstance(ctx, PostgresGraphContext)
    finally:
        await graph_driver.close_driver()


async def test_factory_uses_neo4j_when_reachable(neo4j_graph):
    async with async_session_factory() as session:
        ctx = await get_graph_context(session)
    assert isinstance(ctx, Neo4jGraphContext) and ctx.source == "neo4j"


# ---------------------------------------------------------------------------
# Neo4j parity: identical data in both stores -> identical results
# ---------------------------------------------------------------------------


async def mirror_postgres_to_neo4j() -> None:
    """Write the Postgres data into Neo4j following app.graph.model (test-only sync)."""
    async with async_session_factory() as session:
        rels = (await session.execute(
            text("SELECT skill_a, skill_b, weight FROM skill_relationships")
        )).all()
        freelancers = (await session.execute(
            text("SELECT id, name, rating, skills FROM freelancers")
        )).all()
        projects = (await session.execute(
            text("SELECT id, title, required_skills, nice_to_have_skills FROM projects")
        )).all()
        contracts = (await session.execute(
            text("SELECT freelancer_id, project_id, status FROM contracts")
        )).all()

    names = {a for a, _, _ in rels} | {b for _, b, _ in rels}
    for f in freelancers:
        names.update(f.skills or [])
    for p in projects:
        names.update(p.required_skills or [])
        names.update(p.nice_to_have_skills or [])

    run = graph_driver.run
    for statement in model.CONSTRAINTS:
        await run(statement)
    await run(
        "UNWIND $names AS name MERGE (s:Skill {key: toLower(name)}) ON CREATE SET s.name = name",
        names=sorted(names),
    )
    await run(
        """
        UNWIND $rels AS rel
        MATCH (a:Skill {key: toLower(rel.a)}), (b:Skill {key: toLower(rel.b)})
        MERGE (a)-[r:RELATED_TO]->(b) SET r.weight = rel.w
        """,
        rels=[{"a": a, "b": b, "w": float(w)} for a, b, w in rels],
    )
    await run(
        """
        UNWIND $rows AS row
        MERGE (f:Freelancer {id: row.id}) SET f.name = row.name, f.rating = row.rating
        WITH f, row UNWIND row.skills AS skill
        MATCH (s:Skill {key: toLower(skill)})
        MERGE (f)-[:HAS_SKILL]->(s)
        """,
        rows=[{"id": f.id, "name": f.name, "rating": f.rating, "skills": f.skills or []}
              for f in freelancers],
    )
    await run(
        """
        UNWIND $rows AS row
        MERGE (p:Project {id: row.id}) SET p.title = row.title
        WITH p, row
        UNWIND row.skills AS item
        MATCH (s:Skill {key: toLower(item.name)})
        MERGE (p)-[r:REQUIRES]->(s) SET r.importance = item.importance
        """,
        rows=[
            {"id": p.id, "title": p.title,
             "skills": [{"name": s, "importance": "must"} for s in p.required_skills or []]
             + [{"name": s, "importance": "nice"} for s in p.nice_to_have_skills or []]}
            for p in projects
        ],
    )
    await run(
        """
        UNWIND $rows AS row
        MATCH (f:Freelancer {id: row.f}), (p:Project {id: row.p})
        MERGE (f)-[w:WORKED_ON]->(p) SET w.status = row.status, w.rating = null
        """,
        rows=[{"f": c.freelancer_id, "p": c.project_id, "status": c.status} for c in contracts],
    )
    await run(
        """
        MATCH (a:Freelancer)-[wa:WORKED_ON {status: $completed}]->(p:Project)
              <-[wb:WORKED_ON {status: $completed}]-(b:Freelancer)
        WHERE a.id < b.id
        WITH a, b, count(DISTINCT p) AS n
        MERGE (a)-[c:COLLABORATED_WITH]->(b) SET c.count = n, c.avg_rating = null
        """,
        completed=model.COMPLETED,
    )


async def _both_expand(skills, **kwargs):
    return await _pg_expand(skills, **kwargs), await Neo4jGraphContext().expand_skills(
        skills, **kwargs
    )


async def test_parity_expand_fake_graph(neo4j_graph, fake_edges):
    await mirror_postgres_to_neo4j()
    for hops in (1, 2, 3):
        pg, neo = await _both_expand(["GxA", "GxE", "GxD"], hops=hops, decay=0.5)
        assert pg == neo
        assert pg  # non-trivial


async def test_parity_expand_taxonomy_graph(neo4j_graph):
    await mirror_postgres_to_neo4j()
    skills = ["Python", "React", "Kubernetes", "Machine Learning", "Figma", "Elixir"]
    for hops in (1, 2):
        pg, neo = await _both_expand(skills, hops=hops)
        assert pg == neo
    assert len(pg["python"]) > len((await _pg_expand(["Python"], hops=1))["python"])


async def test_parity_candidate_subgraph(neo4j_graph, scenario, make_freelancer, make_project):
    extra = [
        await make_freelancer(name="Eve", skills=["React", "TypeScript", "Docker"]),
        await make_freelancer(name="Fay", skills=["Django", "PostgreSQL"]),
        await make_freelancer(name="Gus", skills=["Kubernetes", "Go"]),
    ]
    shop = await make_project(
        None, title="Shop", required_skills=["Next.js", "PostgreSQL"],
        nice_to_have_skills=["Kubernetes"],
    )
    for f in extra:
        await _contract(f.id, shop.id)
    await mirror_postgres_to_neo4j()

    ids = scenario["f"] + [f.id for f in extra] + [424_242]
    searches = [
        ["GxA", "GxB", "GxD"],
        ["Next.js", "FastAPI", "Kubernetes", "PostgreSQL"],
        ["GxD", "Node.js", "Terraform"],
        [],
    ]
    for required in searches:
        neo = await Neo4jGraphContext().candidate_subgraph(ids, required)
        pg = await _pg_subgraph(ids, required)
        assert pg == neo, required
        assert set(pg) == set(ids)
    neo_small = await Neo4jGraphContext().candidate_subgraph(
        ids[:3], searches[0], max_paths=1, max_projects=1
    )
    assert neo_small == await _pg_subgraph(ids[:3], searches[0], max_paths=1, max_projects=1)
    eve = (await _pg_subgraph(ids, searches[1]))[extra[0].id]
    assert any(p.hops >= 1 for p in eve.skill_paths)
    assert [p.title for p in eve.past_projects] == ["Shop"]
    assert {c.other_name for c in eve.collaborations} == {"Fay", "Gus"}


async def test_neo4j_subgraph_ids_without_nodes(neo4j_graph):
    graphs = await Neo4jGraphContext().candidate_subgraph([1, 2], ["Python"])
    assert graphs == {1: CandidateGraph(1), 2: CandidateGraph(2)}


# ---------------------------------------------------------------------------
# Skill ontology
# ---------------------------------------------------------------------------


def test_related_skills_use_taxonomy_names_only():
    names = set(CANONICAL_NAMES)
    pairs = set()
    for a, b, weight in RELATED_SKILLS:
        assert a in names and b in names, (a, b)
        assert a != b
        assert 0.0 < weight <= 1.0
        pair = frozenset((a.lower(), b.lower()))
        assert pair not in pairs, (a, b)
        pairs.add(pair)
    assert len(RELATED_SKILLS) >= 250


def test_category_edges_similarity_band_and_curated_precedence():
    vectors = {
        "A": ("X", [1.0, 0.0, 0.0]),
        "B": ("X", [0.9, 0.3, 0.0]),
        "C": ("X", [0.0, 0.0, 1.0]),
        "D": ("Y", [1.0, 0.0, 0.0]),  # identical to A, but another category
        "E": ("Y", [0.95, 0.31, 0.0]),
    }
    edges = category_edges(vectors, top_k=1, min_similarity=0.5, exclude=[])
    assert [(a, b) for a, b, _ in edges] == [("A", "B"), ("D", "E")]  # C too far, no cross-category
    low, high = CATEGORY_EDGE_WEIGHT_BAND
    assert all(low <= w <= high for _, _, w in edges)
    assert edges == category_edges(dict(reversed(list(vectors.items()))), top_k=1,
                                   min_similarity=0.5, exclude=[])  # order-independent
    curated = category_edges(vectors, top_k=1, min_similarity=0.5, exclude=[("b", "a", 0.9)])
    assert [(a, b) for a, b, _ in curated] == [("D", "E")]


async def test_sync_ontology_adds_category_edges_without_overriding_curated():
    async with async_session_factory() as session:
        repo = SkillRelationshipRepository(session)
        try:
            total = await repo.sync_ontology(include_category_edges=True)
            rows = {(r.skill_a, r.skill_b): r.weight for r in await repo.list_all()}
            assert len(rows) == total >= len(RELATED_SKILLS)
            for a, b, w in RELATED_SKILLS:
                assert rows[(a, b)] == w
            curated = {frozenset((a, b)) for a, b, _ in RELATED_SKILLS}
            extra = [(k, w) for k, w in rows.items() if frozenset(k) not in curated]
            low, high = CATEGORY_EDGE_WEIGHT_BAND
            assert all(low <= w <= high for _, w in extra)
        finally:
            await session.rollback()


async def test_sync_ontology_prunes_stale_and_reversed_rows():
    async with async_session_factory() as session:
        repo = SkillRelationshipRepository(session)
        try:
            session.add(SkillRelationship(skill_a="TypeScript", skill_b="JavaScript", weight=0.2))
            session.add(SkillRelationship(skill_a="Figma", skill_b="Kafka", weight=0.4))
            await session.flush()
            total = await repo.sync_ontology(include_category_edges=False)
            assert total == len(RELATED_SKILLS)
            adjacency = await repo.adjacency()
            assert adjacency == related_skill_map(RELATED_SKILLS)
            stale = await session.execute(
                select(SkillRelationship).where(SkillRelationship.skill_a == "Figma")
            )
            assert all(r.skill_b != "Kafka" for r in stale.scalars())
        finally:
            await session.rollback()
