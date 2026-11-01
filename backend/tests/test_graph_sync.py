"""Postgres -> Neo4j sync: outbox, drainer, rebuild, admin endpoints, /health.

Tests using the ``neo4j_graph`` fixture skip when TEST_NEO4J_URI is unreachable.
"""

from sqlalchemy import func, select

from app.core.config import settings
from app.db.repositories.postgres import ContractRepository, FreelancerRepository
from app.db.session import async_session_factory
from app.graph import outbox, sync
from app.models.orm import Contract, GraphOutbox

DEAD_NEO4J_URI = "bolt://127.0.0.1:1"


async def _drain() -> dict:
    async with async_session_factory() as session:
        result = await sync.drain_outbox(session, limit=1000)
        await session.commit()
    return result


async def _outbox_rows() -> list[GraphOutbox]:
    async with async_session_factory() as session:
        return list(
            (await session.execute(select(GraphOutbox).order_by(GraphOutbox.id))).scalars()
        )


async def _counts(driver) -> dict:
    return await sync.graph_counts()


async def _contract(freelancer_id: int, project_id: int, status: str) -> Contract:
    async with async_session_factory() as session:
        contract = await ContractRepository(session).create(
            freelancer_id=freelancer_id, project_id=project_id, status=status
        )
        await session.commit()
    return contract


async def _set_contract_status(contract_id: int, status: str) -> None:
    async with async_session_factory() as session:
        await ContractRepository(session).update_status(contract_id, status)
        await session.commit()


# ------------------------------------------------------------------ outbox

async def test_outbox_not_enqueued_when_neo4j_disabled(make_freelancer):
    await make_freelancer()
    assert await _outbox_rows() == []


async def test_outbox_rows_written_in_the_same_transaction(neo4j_graph, make_freelancer):
    async with async_session_factory() as session:
        freelancer = await FreelancerRepository(session).create(
            name="Tx", skills=["Python"], rating=4.0
        )
        pending = (
            await session.execute(
                select(GraphOutbox.entity_type, GraphOutbox.entity_id, GraphOutbox.op)
            )
        ).all()
        assert [tuple(r) for r in pending] == [("freelancer", freelancer.id, "upsert")]
        await session.rollback()
    assert await _outbox_rows() == []  # rolled back together with the freelancer

    committed = await make_freelancer(name="Kept")
    rows = await _outbox_rows()
    assert [(r.entity_type, r.entity_id, r.op) for r in rows] == [
        ("freelancer", committed.id, "upsert")
    ]
    assert rows[0].processed_at is None and rows[0].attempts == 0


# ------------------------------------------------------------------ drain

async def test_drain_makes_neo4j_match_postgres(neo4j_graph, make_user, make_freelancer, make_project):
    client_user, _ = await make_user("client")
    referrer = await make_freelancer(name="Ref", skills=["Python", "Docker"], experience_years=7)
    worker = await make_freelancer(
        name="Worker", skills=["React", "TypeScript"], referred_by_id=referrer.id, rating=4.2
    )
    project = await make_project(
        client_user.id,
        title="Shop",
        required_skills=["React", "Python"],
        nice_to_have_skills=["Docker", "React"],
    )
    await _contract(worker.id, project.id, "completed")

    result = await _drain()
    assert result["failed"] == 0 and result["processed"] >= 5
    assert all(r.processed_at is not None for r in await _outbox_rows())

    run = neo4j_graph.run
    skills = await run(
        "MATCH (f:Freelancer {id: $id})-[h:HAS_SKILL]->(s:Skill) "
        "RETURN s.key AS key, h.level AS level ORDER BY key",
        id=referrer.id,
    )
    assert skills == [{"key": "docker", "level": 7}, {"key": "python", "level": 7}]

    requires = await run(
        "MATCH (:Project {id: $id})-[r:REQUIRES]->(s:Skill) "
        "RETURN s.key AS key, r.importance AS importance ORDER BY key",
        id=project.id,
    )
    assert requires == [
        {"key": "docker", "importance": "nice"},
        {"key": "python", "importance": "must"},
        {"key": "react", "importance": "must"},
    ]

    posted = await run(
        "MATCH (c:Client)-[:POSTED]->(p:Project) RETURN c.id AS client, c.name AS name, p.id AS project"
    )
    assert posted == [{"client": client_user.id, "name": client_user.name, "project": project.id}]

    referred = await run(
        "MATCH (a:Freelancer)-[:REFERRED_BY]->(b:Freelancer) RETURN a.id AS a, b.id AS b"
    )
    assert referred == [{"a": worker.id, "b": referrer.id}]

    worked = await run(
        "MATCH (f:Freelancer)-[w:WORKED_ON]->(p:Project) "
        "RETURN f.id AS f, p.id AS p, w.status AS status, w.rating AS rating"
    )
    # Contracts have no rating column: WORKED_ON.rating stays null (parity with Postgres).
    assert worked == [{"f": worker.id, "p": project.id, "status": "completed", "rating": None}]

    node = (await run("MATCH (f:Freelancer {id: $id}) RETURN f", id=worker.id))[0]["f"]
    assert node["name"] == "Worker" and node["availability"] is True
    assert node["hourly_rate"] == 50.0 and node["fraud_score"] == 0.05


async def test_drain_and_rebuild_are_idempotent(neo4j_graph, make_user, make_freelancer, make_project):
    client_user, _ = await make_user("client")
    a = await make_freelancer(name="A", skills=["Python", "FastAPI"])
    b = await make_freelancer(name="B", skills=["Python"])
    project = await make_project(client_user.id, required_skills=["Python"])
    await _contract(a.id, project.id, "completed")
    await _contract(b.id, project.id, "completed")

    await _drain()
    first = await _counts(neo4j_graph)

    # Re-enqueue everything and drain again: same graph.
    async with async_session_factory() as session:
        for fid in (a.id, b.id):
            await outbox.enqueue(session, "freelancer", fid)
        await outbox.enqueue(session, "project", project.id)
        await outbox.enqueue(session, "user", client_user.id)
        await session.commit()
    await _drain()
    assert await _counts(neo4j_graph) == first

    async with async_session_factory() as session:
        rebuilt = await sync.full_rebuild(session)
        await session.commit()
    async with async_session_factory() as session:
        rebuilt_again = await sync.full_rebuild(session)
        await session.commit()
    assert rebuilt.nodes == rebuilt_again.nodes
    assert rebuilt.edges == rebuilt_again.edges
    # The rebuild also loads the whole skill ontology; the drained entities match.
    for label in ("Freelancer", "Project", "Client"):
        assert rebuilt.nodes[label] == first["nodes"][label]
    for edge in ("HAS_SKILL", "REQUIRES", "WORKED_ON", "POSTED", "COLLABORATED_WITH"):
        assert rebuilt.edges[edge] == first["edges"][edge]
    assert rebuilt.edges["RELATED_TO"] > 0
    assert rebuilt.nodes["Skill"] > first["nodes"]["Skill"]


async def test_skill_ontology_sync(neo4j_graph):
    async with async_session_factory() as session:
        counts = await sync.sync_skill_ontology(session)
        again = await sync.sync_skill_ontology(session)
    assert counts == again and counts["skills"] > 50 and counts["related_to"] > 0
    graph = await sync.graph_counts()
    assert graph["nodes"]["Skill"] == counts["skills"]
    assert graph["edges"]["RELATED_TO"] == counts["related_to"]
    python = await neo4j_graph.run("MATCH (s:Skill {key: 'python'}) RETURN s.name AS name, s.category AS c")
    assert python == [{"name": "Python", "c": "Languages"}]


async def test_update_removes_stale_has_skill_edges(neo4j_graph, make_freelancer):
    freelancer = await make_freelancer(skills=["Python", "Docker", "React"])
    await _drain()

    async with async_session_factory() as session:
        await FreelancerRepository(session).update(
            freelancer.id, {"skills": ["Python", "Kubernetes"], "experience_years": 9}
        )
        await session.commit()
    await _drain()

    rows = await neo4j_graph.run(
        "MATCH (:Freelancer {id: $id})-[h:HAS_SKILL]->(s:Skill) "
        "RETURN s.key AS key, h.level AS level ORDER BY key",
        id=freelancer.id,
    )
    assert rows == [{"key": "kubernetes", "level": 9}, {"key": "python", "level": 9}]


async def test_collaborations_derived_from_completed_projects(
    neo4j_graph, make_user, make_freelancer, make_project
):
    client_user, _ = await make_user("client")
    a = await make_freelancer(name="A", rating=5.0)
    b = await make_freelancer(name="B", rating=4.0)
    c = await make_freelancer(name="C", rating=3.0)
    p1 = await make_project(client_user.id, title="P1")
    p2 = await make_project(client_user.id, title="P2")
    await _contract(b.id, p1.id, "completed")
    await _contract(a.id, p1.id, "completed")
    pending = await _contract(c.id, p1.id, "active")
    await _drain()

    query = (
        "MATCH (x:Freelancer)-[e:COLLABORATED_WITH]->(y:Freelancer) "
        "RETURN x.id AS x, y.id AS y, e.count AS count, e.avg_rating AS avg ORDER BY x, y"
    )
    assert await neo4j_graph.run(query) == [{"x": a.id, "y": b.id, "count": 1, "avg": None}]

    # A second shared completed project bumps the count; C joins once completed.
    await _contract(a.id, p2.id, "completed")
    await _contract(b.id, p2.id, "completed")
    await _set_contract_status(pending.id, "completed")
    await _drain()
    assert await neo4j_graph.run(query) == [
        {"x": a.id, "y": b.id, "count": 2, "avg": None},
        {"x": a.id, "y": c.id, "count": 1, "avg": None},
        {"x": b.id, "y": c.id, "count": 1, "avg": None},
    ]

    # A deleted contract removes the WORKED_ON edge and its collaborations.
    async with async_session_factory() as session:
        contract = await session.get(Contract, pending.id)
        await session.delete(contract)
        await session.commit()
    await _drain()
    assert await neo4j_graph.run(query) == [{"x": a.id, "y": b.id, "count": 2, "avg": None}]

    # The global recompute agrees with the incremental one.
    await sync.recompute_collaborations()
    assert await neo4j_graph.run(query) == [{"x": a.id, "y": b.id, "count": 2, "avg": None}]


async def test_drainer_survives_neo4j_outage(neo4j_graph, monkeypatch, make_freelancer):
    freelancer = await make_freelancer(name="Offline")

    monkeypatch.setattr(settings, "neo4j_uri", DEAD_NEO4J_URI)
    await neo4j_graph.close_driver()
    result = await _drain()  # must not raise
    assert result == {"processed": 0, "failed": 1}
    [row] = await _outbox_rows()
    assert row.processed_at is None and row.attempts == 1
    assert row.last_error and "unreachable" in row.last_error

    async with async_session_factory() as session:
        assert await sync.outbox_counts(session) == {"pending": 1, "failed": 1}

    # Back online: the same row is retried and succeeds.
    from tests.conftest import TEST_NEO4J_URI

    monkeypatch.setattr(settings, "neo4j_uri", TEST_NEO4J_URI)
    await neo4j_graph.close_driver()
    assert await _drain() == {"processed": 1, "failed": 0}
    [row] = await _outbox_rows()
    assert row.processed_at is not None and row.last_error is None
    found = await neo4j_graph.run("MATCH (f:Freelancer {id: $id}) RETURN f.name AS n", id=freelancer.id)
    assert found == [{"n": "Offline"}]


async def test_requests_succeed_while_neo4j_is_down(monkeypatch, client, make_user):
    """Enabled but unreachable Neo4j must not fail writes; rows wait in the outbox."""
    monkeypatch.setattr(settings, "neo4j_uri", DEAD_NEO4J_URI)
    from app.graph import driver

    await driver.close_driver()
    try:
        _, headers = await make_user("freelancer")
        created = await client.post(
            "/freelancers",
            json={"name": "Down", "skills": ["Python"], "hourly_rate": 40, "experience_years": 3},
            headers=headers,
        )
        assert created.status_code in (200, 201), created.text
        assert any(r.entity_type == "freelancer" for r in await _outbox_rows())
    finally:
        await driver.close_driver()


# ------------------------------------------------------------------ admin endpoints

async def test_admin_graph_endpoints_require_admin(client, make_user):
    _, client_headers = await make_user("client")
    for method, url in (("post", "/admin/graph/rebuild"), ("get", "/admin/graph/status")):
        assert (await getattr(client, method)(url)).status_code == 401
        assert (await getattr(client, method)(url, headers=client_headers)).status_code == 403


async def test_admin_graph_when_disabled(client, make_user):
    _, admin = await make_user("admin")
    rebuilt = await client.post("/admin/graph/rebuild", headers=admin)
    assert rebuilt.status_code == 409 and "disabled" in rebuilt.json()["detail"]

    status = (await client.get("/admin/graph/status", headers=admin)).json()
    assert status["enabled"] is False and status["reachable"] is False
    assert status["outbox_pending"] == 0 and status["nodes"] is None


async def test_admin_graph_when_unreachable(monkeypatch, client, make_user):
    _, admin = await make_user("admin")
    monkeypatch.setattr(settings, "neo4j_uri", DEAD_NEO4J_URI)
    from app.graph import driver

    await driver.close_driver()
    try:
        rebuilt = await client.post("/admin/graph/rebuild", headers=admin)
        assert rebuilt.status_code == 503 and "unreachable" in rebuilt.json()["detail"]
        status = (await client.get("/admin/graph/status", headers=admin)).json()
        assert status["enabled"] is True and status["reachable"] is False
        assert status["nodes"] is None and "unreachable" in status["error"]
    finally:
        await driver.close_driver()


async def test_admin_graph_rebuild_and_status(neo4j_graph, client, make_user, make_freelancer, make_project):
    client_user, _ = await make_user("client")
    _, admin = await make_user("admin")
    freelancer = await make_freelancer(skills=["Python", "React"])
    project = await make_project(client_user.id)
    await _contract(freelancer.id, project.id, "active")

    before = (await client.get("/admin/graph/status", headers=admin)).json()
    assert before["enabled"] and before["reachable"] and before["outbox_pending"] >= 3

    rebuilt = await client.post("/admin/graph/rebuild", headers=admin)
    assert rebuilt.status_code == 200, rebuilt.text
    body = rebuilt.json()
    assert body["nodes"]["Freelancer"] == 1 and body["nodes"]["Project"] == 1
    assert body["nodes"]["Client"] == 1 and body["edges"]["WORKED_ON"] == 1
    assert body["duration_ms"] >= 0

    after = (await client.get("/admin/graph/status", headers=admin)).json()
    assert after["outbox_pending"] == 0 and after["outbox_failed"] == 0
    assert after["nodes"] == body["nodes"] and after["edges"] == body["edges"]


async def test_seed_rebuilds_graph(neo4j_graph, client, make_user):
    _, admin = await make_user("admin")
    seeded = await client.post("/seed", json={"freelancer_count": 4}, headers=admin)
    assert seeded.status_code == 200, seeded.text
    graph = await sync.graph_counts()
    assert graph["nodes"]["Freelancer"] == 4 and graph["nodes"]["Project"] == 1
    assert graph["edges"]["WORKED_ON"] == 3
    async with async_session_factory() as session:
        assert (await sync.outbox_counts(session))["pending"] == 0
        assert await session.scalar(select(func.count()).select_from(GraphOutbox)) > 0


# ------------------------------------------------------------------ health

async def test_health_reports_neo4j_disabled(client):
    body = (await client.get("/health")).json()
    assert body["neo4j"] == "disabled" and body["status"] == "ok"


async def test_health_reports_neo4j_ok(neo4j_graph, client):
    body = (await client.get("/health")).json()
    assert body["neo4j"] == "ok" and body["status"] == "ok"


async def test_health_degraded_when_neo4j_unreachable(monkeypatch, client):
    from app.graph import driver

    monkeypatch.setattr(settings, "neo4j_uri", DEAD_NEO4J_URI)
    await driver.close_driver()
    try:
        body = (await client.get("/health")).json()
        assert body["neo4j"] == "error" and body["status"] == "degraded"
    finally:
        await driver.close_driver()


# ------------------------------------------------------------------ parity with GraphContext

async def test_synced_graph_matches_postgres_graph_context(
    neo4j_graph, make_user, make_freelancer, make_project
):
    """The production sync (drain and rebuild) gives Neo4jGraphContext the same facts
    as the Postgres fallback."""
    from app.graph.neo4j_context import Neo4jGraphContext
    from app.graph.postgres_context import PostgresGraphContext

    client_user, _ = await make_user("client")
    people = [
        await make_freelancer(name="Eve", skills=["React", "TypeScript", "Docker"]),
        await make_freelancer(name="Fay", skills=["Django", "PostgreSQL"]),
        await make_freelancer(name="Gus", skills=["Kubernetes", "Go"]),
        await make_freelancer(name="Hal", skills=["Python", "FastAPI"]),
    ]
    shop = await make_project(
        client_user.id, title="Shop", required_skills=["Next.js", "PostgreSQL"],
        nice_to_have_skills=["Kubernetes"],
    )
    api = await make_project(client_user.id, title="API", required_skills=["Python", "Docker"])
    for f in people[:3]:
        await _contract(f.id, shop.id, "completed")
    await _contract(people[3].id, api.id, "completed")
    await _contract(people[0].id, api.id, "active")

    ids = [f.id for f in people]
    searches = [["Next.js", "FastAPI", "Kubernetes", "PostgreSQL"], ["Python", "Terraform"], []]

    async def assert_parity() -> None:
        async with async_session_factory() as session:
            pg = PostgresGraphContext(session)
            neo = Neo4jGraphContext()
            for required in searches:
                assert await pg.candidate_subgraph(ids, required) == await neo.candidate_subgraph(
                    ids, required
                ), required
            skills = ["Python", "React", "Kubernetes", "PostgreSQL"]
            assert await pg.expand_skills(skills) == await neo.expand_skills(skills)

    # Incremental path: ontology as at app startup, entities via the outbox.
    async with async_session_factory() as session:
        await sync.apply_constraints()
        await sync.sync_skill_ontology(session)
    await _drain()
    await assert_parity()

    async with async_session_factory() as session:
        await sync.full_rebuild(session)
        await session.commit()
    await assert_parity()
