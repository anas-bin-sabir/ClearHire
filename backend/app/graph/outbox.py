"""Transactional outbox for the Postgres -> Neo4j sync.

A SQLAlchemy ``after_flush`` listener on every ``Session`` turns ORM changes to
Freelancer / Project / Contract / User (and the skill taxonomy) into ``graph_outbox``
rows, written on the flush's own connection, so they commit or roll back together
with the change. Repositories don't call anything; ``app.graph.sync.drain_outbox``
processes the rows later.

Decisions:
  * Rows are only enqueued when Neo4j is enabled (``NEO4J_URI`` set). Postgres-only
    deployments pay one boolean check per flush and the table never grows. When Neo4j
    is enabled later, run ``POST /admin/graph/rebuild`` once to catch up.
  * Only ORM unit-of-work changes are captured. Bulk Core/ORM statements
    (``delete(Freelancer)``, ``insert().on_conflict_do_update()`` as in
    ``UserRepository.upsert``) bypass flush events; the seeder therefore ends with a
    full rebuild, and callers doing other bulk writes can call ``enqueue()``.
  * Users are enqueued only when their role is "client" (Client nodes).
  * A deleted Contract enqueues an upsert of its *freelancer*: the freelancer sync
    reconciles all WORKED_ON edges and collaborations from Postgres, which is the only
    way to remove the edge once the contract row (and its pair) is gone.
  * Skill / SkillRelationship ORM changes enqueue one ``skill_relationships`` row
    (entity_id 0), which re-syncs the whole (small) ontology.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import event, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.graph import driver
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

ENTITY_TYPES = ("freelancer", "project", "contract", "user", "skill_relationships")
OPS = ("upsert", "delete")

_ENTITY_OF: dict[type, str] = {
    Freelancer: "freelancer",
    Project: "project",
    Contract: "contract",
    User: "user",
}


def _row(entity_type: str, entity_id: int, op: str) -> dict:
    return {
        "entity_type": entity_type,
        "entity_id": int(entity_id),
        "op": op,
        "created_at": datetime.now(timezone.utc),
        "attempts": 0,
    }


def _collect(session: Session) -> list[dict]:
    keys: dict[tuple[str, int], str] = {}  # (type, id) -> op; last op wins

    def add(entity_type: str, entity_id: int | None, op: str) -> None:
        if entity_id is None:
            return
        keys[(entity_type, int(entity_id))] = op

    for obj in session.new:
        _handle(obj, "upsert", add)
    for obj in session.dirty:
        if session.is_modified(obj, include_collections=False):
            _handle(obj, "upsert", add)
    for obj in session.deleted:
        _handle(obj, "delete", add)
    return [_row(t, i, op) for (t, i), op in keys.items()]


def _handle(obj: object, op: str, add) -> None:
    if isinstance(obj, (Skill, SkillRelationship)):
        add("skill_relationships", 0, "upsert")
        return
    entity_type = _ENTITY_OF.get(type(obj))
    if entity_type is None:
        return
    if entity_type == "user" and getattr(obj, "role", None) != "client":
        return
    if entity_type == "contract" and op == "delete":
        # The edge can only be found through the freelancer once the row is gone.
        add("freelancer", getattr(obj, "freelancer_id", None), "upsert")
        return
    add(entity_type, getattr(obj, "id", None), op)


def _after_flush(session: Session, flush_context) -> None:  # noqa: ANN001
    if not driver.is_enabled():
        return
    rows = _collect(session)
    if not rows:
        return
    # Core insert on the flush's connection: same transaction, no ORM recursion.
    session.connection().execute(insert(GraphOutbox.__table__), rows)


_installed = False


def install() -> None:
    """Register the listener once per process (idempotent; done on import)."""
    global _installed
    if _installed:
        return
    event.listen(Session, "after_flush", _after_flush)
    _installed = True


async def enqueue(
    session: AsyncSession, entity_type: str, entity_id: int, op: str = "upsert"
) -> None:
    """Manually enqueue work (for bulk statements the listener cannot see)."""
    if entity_type not in ENTITY_TYPES or op not in OPS:
        raise ValueError(f"bad outbox entry {entity_type}/{op}")
    if not driver.is_enabled():
        return
    await session.execute(insert(GraphOutbox.__table__), [_row(entity_type, entity_id, op)])


install()
