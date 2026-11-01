"""Postgres -> Neo4j sync: idempotent MERGE upserts, full rebuild, outbox drainer.

Everything here follows ``app.graph.model``. Postgres is authoritative: each entity
sync re-reads the current row and reconciles the graph to it (a missing row means
"delete"), so replaying, reordering or duplicating outbox rows is harmless.

Notes on derived properties:
  * ``WORKED_ON.rating`` is always null: contracts have no rating column, and the
    freelancer's profile rating is not a per-contract rating. Keeping it null keeps
    Neo4j in parity with the Postgres GraphContext fallback (which has no rating).
  * ``COLLABORATED_WITH {count, avg_rating}``: for each pair of freelancers with
    completed WORKED_ON edges to the same project, count = shared completed projects,
    avg_rating = mean over those projects of the two WORKED_ON ratings (nulls ignored),
    which is null until a real contract/review rating exists. Stored once per pair,
    lower id -> higher id.
  * ``Skill.name`` is the canonical name (skills table / taxonomy), key = lower(name).
  * ``Project.status`` is not set (projects have no status column yet).
  * ``REVIEWED`` is not written (no review table yet).

A Neo4j outage never propagates into API requests: the drainer catches and records
errors on outbox rows, and the background loop logs and keeps going.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.skill_taxonomy import TAXONOMY
from app.core.config import settings
from app.graph import driver
from app.graph import outbox as _outbox  # noqa: F401  (installs the flush listener)
from app.graph.model import COMPLETED, CONSTRAINTS
from app.models.orm import (
    Contract,
    Freelancer,
    GraphOutbox,
    Project,
    Skill,
    SkillRelationship,
    User,
)

logger = logging.getLogger(__name__)

BATCH_SIZE = 500
DRAIN_LIMIT = 100
# Processed outbox rows older than this are deleted by the drainer.
OUTBOX_RETENTION = timedelta(days=1)
PING_TIMEOUT_SECONDS = 5.0

_CATEGORY = {s.name.lower(): s.category for s in TAXONOMY}
_CANONICAL = {s.name.lower(): s.name for s in TAXONOMY}


def _chunks(items: list, size: int = BATCH_SIZE) -> Iterable[list]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _skill_rows(names: Iterable[str]) -> list[dict]:
    rows: dict[str, dict] = {}
    for name in names or []:
        if not name or not str(name).strip():
            continue
        name = str(name).strip()
        key = name.lower()
        rows.setdefault(
            key,
            {"key": key, "name": _CANONICAL.get(key, name), "category": _CATEGORY.get(key)},
        )
    return list(rows.values())


# --------------------------------------------------------------------------- Cypher

_UPSERT_FREELANCERS = """
UNWIND $rows AS row
MERGE (f:Freelancer {id: row.id})
SET f.name = row.name, f.rating = row.rating, f.fraud_score = row.fraud_score,
    f.availability = row.availability, f.hourly_rate = row.hourly_rate
WITH f, row
OPTIONAL MATCH (f)-[old:HAS_SKILL]->(s:Skill)
WHERE NOT s.key IN [x IN row.skills | x.key]
DELETE old
WITH DISTINCT f, row
FOREACH (sk IN row.skills |
  MERGE (s:Skill {key: sk.key})
  ON CREATE SET s.name = sk.name, s.category = sk.category
  MERGE (f)-[h:HAS_SKILL]->(s)
  SET h.level = row.level
)
"""

_REFERRALS = """
UNWIND $rows AS row
MATCH (f:Freelancer {id: row.id})
OPTIONAL MATCH (f)-[old:REFERRED_BY]->(r:Freelancer)
WHERE row.referred_by_id IS NULL OR r.id <> row.referred_by_id
DELETE old
WITH DISTINCT f, row
WHERE row.referred_by_id IS NOT NULL
MERGE (r:Freelancer {id: row.referred_by_id})
MERGE (f)-[:REFERRED_BY]->(r)
"""

_UPSERT_CLIENTS = """
UNWIND $rows AS row
MERGE (c:Client {id: row.id})
SET c.name = row.name
"""

_UPSERT_PROJECTS = """
UNWIND $rows AS row
MERGE (p:Project {id: row.id})
SET p.title = row.title
WITH p, row
OPTIONAL MATCH (p)-[old:REQUIRES]->(s:Skill)
WHERE NOT s.key IN [x IN row.skills | x.key]
DELETE old
WITH DISTINCT p, row
OPTIONAL MATCH (c:Client)-[oldp:POSTED]->(p)
WHERE row.client_id IS NULL OR c.id <> row.client_id
DELETE oldp
WITH DISTINCT p, row
FOREACH (sk IN row.skills |
  MERGE (s:Skill {key: sk.key})
  ON CREATE SET s.name = sk.name, s.category = sk.category
  MERGE (p)-[r:REQUIRES]->(s)
  SET r.importance = sk.importance
)
FOREACH (cid IN CASE WHEN row.client_id IS NULL THEN [] ELSE [row.client_id] END |
  MERGE (c:Client {id: cid})
  ON CREATE SET c.name = row.client_name
  MERGE (c)-[:POSTED]->(p)
)
"""

_UPSERT_WORKED_ON = """
UNWIND $rows AS row
MERGE (f:Freelancer {id: row.freelancer_id})
MERGE (p:Project {id: row.project_id})
MERGE (f)-[w:WORKED_ON]->(p)
SET w.status = row.status, w.rating = row.rating
"""

_PRUNE_WORKED_ON = """
MATCH (f:Freelancer {id: $id})-[w:WORKED_ON]->(p:Project)
WHERE NOT p.id IN $project_ids
DELETE w
"""

_DELETE_COLLABS_ALL = "MATCH ()-[c:COLLABORATED_WITH]->() DELETE c"
_DELETE_COLLABS_FOR = """
MATCH (a:Freelancer)-[c:COLLABORATED_WITH]-(b:Freelancer)
WHERE a.id IN $ids
DELETE c
"""
_DERIVE_COLLABS = """
MATCH (a:Freelancer)-[w1:WORKED_ON {status: $completed}]->(p:Project)
      <-[w2:WORKED_ON {status: $completed}]-(b:Freelancer)
WHERE a.id < b.id AND ($ids IS NULL OR a.id IN $ids OR b.id IN $ids)
WITH a, b, count(DISTINCT p) AS n,
     avg(CASE
           WHEN w1.rating IS NULL AND w2.rating IS NULL THEN null
           WHEN w1.rating IS NULL THEN w2.rating
           WHEN w2.rating IS NULL THEN w1.rating
           ELSE (w1.rating + w2.rating) / 2.0
         END) AS r
MERGE (a)-[c:COLLABORATED_WITH]->(b)
SET c.count = n, c.avg_rating = r
RETURN count(c) AS edges
"""

_UPSERT_SKILLS = """
UNWIND $rows AS row
MERGE (s:Skill {key: row.key})
SET s.name = row.name, s.category = row.category
"""

_UPSERT_RELATED = """
UNWIND $rows AS row
MERGE (a:Skill {key: row.a_key}) ON CREATE SET a.name = row.a, a.category = row.a_category
MERGE (b:Skill {key: row.b_key}) ON CREATE SET b.name = row.b, b.category = row.b_category
MERGE (a)-[r:RELATED_TO]-(b)
SET r.weight = row.weight
"""

_PRUNE_RELATED = """
MATCH (a:Skill)-[r:RELATED_TO]->(b:Skill)
WHERE NOT [a.key, b.key] IN $pairs AND NOT [b.key, a.key] IN $pairs
DELETE r
"""


# ------------------------------------------------------------------ row builders

def _freelancer_row(f: Any) -> dict:
    skills = _skill_rows(f.skills or [])
    return {
        "id": f.id,
        "name": f.name,
        "rating": float(f.rating or 0.0),
        "fraud_score": float(f.fraud_score or 0.0),
        "availability": bool(f.availability),
        "hourly_rate": float(f.hourly_rate or 0.0),
        "level": int(f.experience_years or 0),
        "skills": skills,
        "referred_by_id": f.referred_by_id,
    }


def _project_row(p: Any, client_name: str | None) -> dict:
    skills = [dict(s, importance="must") for s in _skill_rows(p.required_skills or [])]
    must = {s["key"] for s in skills}
    skills += [
        dict(s, importance="nice")
        for s in _skill_rows(p.nice_to_have_skills or [])
        if s["key"] not in must
    ]
    return {
        "id": p.id,
        "title": p.title,
        "client_id": p.client_id,
        "client_name": client_name,
        "skills": skills,
    }


def _worked_on_row(freelancer_id: int, project_id: int, status: str) -> dict:
    # rating stays null until contracts carry a real rating (see module docstring).
    return {
        "freelancer_id": freelancer_id,
        "project_id": project_id,
        "status": status,
        "rating": None,
    }


_FREELANCER_COLS = (
    Freelancer.id,
    Freelancer.name,
    Freelancer.skills,
    Freelancer.rating,
    Freelancer.fraud_score,
    Freelancer.availability,
    Freelancer.hourly_rate,
    Freelancer.experience_years,
    Freelancer.referred_by_id,
)
_PROJECT_COLS = (
    Project.id,
    Project.title,
    Project.client_id,
    Project.required_skills,
    Project.nice_to_have_skills,
)


# ------------------------------------------------------------------ entity sync

async def apply_constraints() -> None:
    for statement in CONSTRAINTS:
        await driver.run(statement)


async def recompute_collaborations(freelancer_ids: list[int] | None = None) -> int:
    """Re-derive COLLABORATED_WITH, globally or only for pairs touching the ids."""
    if freelancer_ids is None:
        await driver.run(_DELETE_COLLABS_ALL)
        ids = None
    else:
        ids = sorted({int(i) for i in freelancer_ids})
        if not ids:
            return 0
        await driver.run(_DELETE_COLLABS_FOR, ids=ids)
    rows = await driver.run(_DERIVE_COLLABS, ids=ids, completed=COMPLETED)
    return int(rows[0]["edges"]) if rows else 0


async def sync_freelancer(session: AsyncSession, freelancer_id: int) -> None:
    """Node, HAS_SKILL (stale edges removed), REFERRED_BY, WORKED_ON, collaborations."""
    row = (
        await session.execute(select(*_FREELANCER_COLS).where(Freelancer.id == freelancer_id))
    ).first()
    if row is None:
        await delete_freelancer(freelancer_id)
        return
    data = _freelancer_row(row)
    await driver.run(_UPSERT_FREELANCERS, rows=[data])
    await driver.run(_REFERRALS, rows=[data])
    contracts = (
        await session.execute(
            select(Contract.project_id, Contract.status).where(
                Contract.freelancer_id == freelancer_id
            )
        )
    ).all()
    await driver.run(
        _PRUNE_WORKED_ON, id=freelancer_id, project_ids=[c.project_id for c in contracts]
    )
    if contracts:
        await driver.run(
            _UPSERT_WORKED_ON,
            rows=[
                _worked_on_row(freelancer_id, c.project_id, c.status)
                for c in contracts
            ],
        )
    await recompute_collaborations([freelancer_id])


async def delete_freelancer(freelancer_id: int) -> None:
    await driver.run("MATCH (f:Freelancer {id: $id}) DETACH DELETE f", id=freelancer_id)


async def sync_project(session: AsyncSession, project_id: int) -> None:
    """Node, REQUIRES {importance} (stale edges removed), Client-[:POSTED]->."""
    row = (await session.execute(select(*_PROJECT_COLS).where(Project.id == project_id))).first()
    if row is None:
        await delete_project(project_id)
        return
    client_name = None
    if row.client_id is not None:
        client_name = await session.scalar(select(User.name).where(User.id == row.client_id))
    await driver.run(_UPSERT_PROJECTS, rows=[_project_row(row, client_name)])


async def delete_project(project_id: int) -> None:
    workers = await driver.run(
        "MATCH (f:Freelancer)-[:WORKED_ON]->(:Project {id: $id}) RETURN f.id AS id",
        id=project_id,
    )
    await driver.run("MATCH (p:Project {id: $id}) DETACH DELETE p", id=project_id)
    await recompute_collaborations([w["id"] for w in workers])


async def sync_contract(session: AsyncSession, contract_id: int) -> None:
    """WORKED_ON {status, rating} + collaborations of everyone on that project."""
    row = (
        await session.execute(
            select(Contract.freelancer_id, Contract.project_id, Contract.status)
            .where(Contract.id == contract_id)
        )
    ).first()
    if row is None:
        # Deleted: the listener also enqueued the freelancer, which reconciles edges.
        return
    await driver.run(
        _UPSERT_WORKED_ON,
        rows=[_worked_on_row(row.freelancer_id, row.project_id, row.status)],
    )
    team = (
        await session.execute(
            select(Contract.freelancer_id).where(Contract.project_id == row.project_id)
        )
    ).scalars().all()
    await recompute_collaborations(list(team))


async def sync_user(session: AsyncSession, user_id: int) -> None:
    """Client node for a client user; removed when the user is gone."""
    user = (await session.execute(select(User.id, User.name, User.role).where(User.id == user_id))).first()
    if user is None:
        await driver.run("MATCH (c:Client {id: $id}) DETACH DELETE c", id=user_id)
        return
    await driver.run(_UPSERT_CLIENTS, rows=[{"id": user.id, "name": user.name}])


async def sync_skill_ontology(session: AsyncSession) -> dict[str, int]:
    """Skill nodes from ``skills`` (with category) + RELATED_TO from skill_relationships."""
    skills = (await session.execute(select(Skill.name, Skill.category))).all()
    skill_rows = [{"key": s.name.lower(), "name": s.name, "category": s.category} for s in skills]
    for chunk in _chunks(skill_rows):
        await driver.run(_UPSERT_SKILLS, rows=chunk)

    categories = {r["key"]: r["category"] for r in skill_rows}
    rels = (
        await session.execute(
            select(SkillRelationship.skill_a, SkillRelationship.skill_b, SkillRelationship.weight)
        )
    ).all()
    seen: dict[tuple[str, str], dict] = {}
    for a, b, weight in rels:
        ka, kb = a.lower(), b.lower()
        if ka == kb:
            continue
        if kb < ka:
            a, b, ka, kb = b, a, kb, ka
        pair = (ka, kb)
        seen[pair] = {
            "a": a, "b": b, "a_key": ka, "b_key": kb,
            "a_category": categories.get(ka, _CATEGORY.get(ka)),
            "b_category": categories.get(kb, _CATEGORY.get(kb)),
            "weight": float(weight),
        }
    rel_rows = list(seen.values())
    for chunk in _chunks(rel_rows):
        await driver.run(_UPSERT_RELATED, rows=chunk)
    await driver.run(_PRUNE_RELATED, pairs=[list(p) for p in seen])
    return {"skills": len(skill_rows), "related_to": len(rel_rows)}


async def sync_entity(session: AsyncSession, entity_type: str, entity_id: int, op: str) -> None:
    if entity_type == "freelancer":
        if op == "delete":
            await delete_freelancer(entity_id)
        else:
            await sync_freelancer(session, entity_id)
    elif entity_type == "project":
        if op == "delete":
            await delete_project(entity_id)
        else:
            await sync_project(session, entity_id)
    elif entity_type == "contract":
        await sync_contract(session, entity_id)
    elif entity_type == "user":
        await sync_user(session, entity_id)
    elif entity_type == "skill_relationships":
        await apply_constraints()  # IF NOT EXISTS; covers a Neo4j that was down at boot
        await sync_skill_ontology(session)
    else:
        raise ValueError(f"unknown outbox entity_type {entity_type!r}")


# ------------------------------------------------------------------ full rebuild

@dataclass
class RebuildResult:
    nodes: dict[str, int] = field(default_factory=dict)
    edges: dict[str, int] = field(default_factory=dict)
    duration_ms: float = 0.0

    def as_dict(self) -> dict:
        return asdict(self)


async def graph_counts() -> dict[str, dict[str, int]]:
    node_rows = await driver.run(
        "MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS n"
    )
    edge_rows = await driver.run("MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS n")
    return {
        "nodes": {r["label"]: int(r["n"]) for r in node_rows},
        "edges": {r["type"]: int(r["n"]) for r in edge_rows},
    }


async def _wipe() -> None:
    while True:
        rows = await driver.run(
            "MATCH (n) WITH n LIMIT 5000 DETACH DELETE n RETURN count(*) AS n"
        )
        if not rows or int(rows[0]["n"]) == 0:
            return


async def full_rebuild(session: AsyncSession) -> RebuildResult:
    """Apply constraints, wipe the graph and rebuild it from Postgres in batches.

    Outbox rows that existed when the rebuild started are marked processed (the
    caller commits). Not atomic: graph reads during a rebuild see partial data.
    """
    started = time.perf_counter()
    max_outbox_id = await session.scalar(select(func.max(GraphOutbox.id)))

    await apply_constraints()
    await _wipe()
    await sync_skill_ontology(session)

    clients = (
        await session.execute(
            select(User.id, User.name).where(
                (User.role == "client") | User.id.in_(select(Project.client_id))
            )
        )
    ).all()
    client_names = {c.id: c.name for c in clients}
    for chunk in _chunks([{"id": c.id, "name": c.name} for c in clients]):
        await driver.run(_UPSERT_CLIENTS, rows=chunk)

    freelancers = [_freelancer_row(r) for r in (await session.execute(select(*_FREELANCER_COLS))).all()]
    for chunk in _chunks(freelancers):
        await driver.run(_UPSERT_FREELANCERS, rows=chunk)
    for chunk in _chunks([f for f in freelancers if f["referred_by_id"] is not None]):
        await driver.run(_REFERRALS, rows=chunk)

    projects = [
        _project_row(r, client_names.get(r.client_id))
        for r in (await session.execute(select(*_PROJECT_COLS))).all()
    ]
    for chunk in _chunks(projects):
        await driver.run(_UPSERT_PROJECTS, rows=chunk)

    contracts = (
        await session.execute(
            select(Contract.freelancer_id, Contract.project_id, Contract.status)
        )
    ).all()
    for chunk in _chunks([_worked_on_row(*c) for c in contracts]):
        await driver.run(_UPSERT_WORKED_ON, rows=chunk)

    await recompute_collaborations()

    if max_outbox_id is not None:
        await session.execute(
            update(GraphOutbox)
            .where(GraphOutbox.id <= max_outbox_id, GraphOutbox.processed_at.is_(None))
            .values(processed_at=datetime.now(timezone.utc))
        )
    counts = await graph_counts()
    return RebuildResult(
        nodes=counts["nodes"],
        edges=counts["edges"],
        duration_ms=round((time.perf_counter() - started) * 1000, 1),
    )


async def rebuild_if_enabled(session: AsyncSession) -> RebuildResult | None:
    """Best-effort full rebuild (after seeding). Never raises; commits the outbox update."""
    if not driver.is_enabled():
        return None
    try:
        result = await full_rebuild(session)
        await session.commit()
        logger.info("graph rebuilt: %s", result.as_dict())
        return result
    except Exception as exc:  # noqa: BLE001 - Neo4j is optional
        logger.warning("graph rebuild skipped: %s", exc)
        try:
            await session.rollback()
        except Exception:  # noqa: BLE001
            pass
        return None


# ------------------------------------------------------------------ outbox drainer

async def _reachable() -> str | None:
    """None when Neo4j answers, else the error message."""
    try:
        status = await asyncio.wait_for(driver.ping(), timeout=PING_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001
        return f"neo4j unreachable: {exc}"
    return None if status == "ok" else f"neo4j unreachable (ping={status})"


_outage = False


async def drain_outbox(session: AsyncSession, limit: int = DRAIN_LIMIT) -> dict[str, int]:
    """Process up to ``limit`` pending outbox rows. Never raises for Neo4j errors.

    Rows for the same entity are coalesced (synced once, all marked processed).
    Failures increment ``attempts`` and store ``last_error``; the rows stay pending
    and are retried on the next drain (least-attempted first). The caller commits.
    Returns {"processed": n, "failed": n}.
    """
    if not driver.is_enabled():
        return {"processed": 0, "failed": 0}
    rows = list(
        (
            await session.execute(
                select(GraphOutbox)
                .where(GraphOutbox.processed_at.is_(None))
                .order_by(GraphOutbox.attempts, GraphOutbox.id)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        ).scalars()
    )
    if not rows:
        return {"processed": 0, "failed": 0}

    groups: dict[tuple[str, int], list[GraphOutbox]] = {}
    for row in sorted(rows, key=lambda r: r.id):
        groups.setdefault((row.entity_type, row.entity_id), []).append(row)

    def fail(items: list[GraphOutbox], message: str) -> None:
        for item in items:
            item.attempts = (item.attempts or 0) + 1
            item.last_error = message[:2000]

    global _outage
    unreachable = await _reachable()
    if unreachable:
        fail(rows, unreachable)
        await session.flush()
        # Warn once per outage, not on every drain cycle.
        (logger.debug if _outage else logger.warning)(
            "graph outbox: %s (%d rows pending)", unreachable, len(rows)
        )
        _outage = True
        return {"processed": 0, "failed": len(rows)}
    if _outage:
        logger.warning("graph outbox: Neo4j reachable again, resuming sync")
        _outage = False

    processed = failed = 0
    now = datetime.now(timezone.utc)
    for (entity_type, entity_id), items in groups.items():
        op = items[-1].op  # latest wins; sync re-reads Postgres anyway
        try:
            await sync_entity(session, entity_type, entity_id, op)
        except Exception as exc:  # noqa: BLE001 - recorded on the row
            logger.warning("graph sync %s/%s failed: %s", entity_type, entity_id, exc)
            fail(items, f"{type(exc).__name__}: {exc}")
            failed += len(items)
            continue
        for item in items:
            item.processed_at = now
            item.last_error = None
        processed += len(items)

    await session.execute(
        delete(GraphOutbox).where(
            GraphOutbox.processed_at.is_not(None),
            GraphOutbox.processed_at < now - OUTBOX_RETENTION,
        )
    )
    await session.flush()
    return {"processed": processed, "failed": failed}


async def outbox_counts(session: AsyncSession) -> dict[str, int]:
    pending = await session.scalar(
        select(func.count()).select_from(GraphOutbox).where(GraphOutbox.processed_at.is_(None))
    )
    failed = await session.scalar(
        select(func.count())
        .select_from(GraphOutbox)
        .where(GraphOutbox.processed_at.is_(None), GraphOutbox.attempts > 0)
    )
    return {"pending": int(pending or 0), "failed": int(failed or 0)}


# ------------------------------------------------------------------ background loop

_task: asyncio.Task | None = None


async def _drain_loop(interval: float) -> None:
    from app.db.session import async_session_factory

    while True:
        busy = False
        try:
            async with async_session_factory() as session:
                result = await drain_outbox(session)
                await session.commit()
            busy = result["processed"] >= DRAIN_LIMIT
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - the loop must survive anything
            logger.warning("graph outbox drain failed: %s", exc)
        if not busy:
            await asyncio.sleep(interval)


def start_drainer(interval: float | None = None) -> asyncio.Task | None:
    """Start the background drainer (no-op when Neo4j is disabled or already running)."""
    global _task
    if not driver.is_enabled():
        return None
    if _task is not None and not _task.done():
        return _task
    _task = asyncio.create_task(
        _drain_loop(interval or settings.graph_sync_interval_seconds), name="graph-outbox-drainer"
    )
    return _task


async def stop_drainer() -> None:
    global _task
    task, _task = _task, None
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("graph outbox drainer crashed")
