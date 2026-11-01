"""GraphContext over Postgres: recursive CTEs on skill_relationships + contracts.

Used whenever Neo4j is disabled or unreachable. Each call runs a fixed number of
queries (expand_skills: 1; candidate_subgraph: at most 4), never one per candidate.
Scoring, tie-breaking and ordering live in app.graph.paths, shared with Neo4j.
"""

from __future__ import annotations

from sqlalchemy import Integer, String, bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.graph import model
from app.graph.context import CandidateGraph, GraphSource
from app.graph.paths import (
    ProjectRow,
    RawPath,
    SharedProjectRow,
    assemble,
    best_paths,
    expansion,
    normalize_skills,
)

# Every simple path of 1..:hops edges starting at one of :starts, walking
# skill_relationships undirected. Pairs stored twice (either orientation, or with
# different casing) collapse to one edge with the max weight, matching
# SkillRelationshipRepository.adjacency(). ``NOT e.b = ANY(walk.keys)`` keeps
# paths simple, so cycles terminate. :targets (nullable) filters the end node.
_WALK_SQL = """
WITH RECURSIVE pairs AS (
    SELECT lower(skill_a) AS a, lower(skill_b) AS b, skill_a AS na, skill_b AS nb, weight
    FROM skill_relationships
    UNION ALL
    SELECT lower(skill_b), lower(skill_a), skill_b, skill_a, weight
    FROM skill_relationships
),
e AS (
    SELECT a, b, max(na) AS na, max(nb) AS nb, max(weight) AS w
    FROM pairs
    WHERE a <> b
    GROUP BY a, b
),
walk(node, keys, names, weights) AS (
    SELECT e.b, ARRAY[e.a, e.b]::text[], ARRAY[e.na, e.nb]::text[], ARRAY[e.w]::float8[]
    FROM e
    WHERE e.a = ANY(:starts)
    UNION ALL
    SELECT e.b, walk.keys || e.b, walk.names || e.nb, walk.weights || e.w::float8
    FROM walk
    JOIN e ON e.a = walk.node
    WHERE cardinality(walk.weights) < :hops
      AND NOT e.b = ANY(walk.keys)
)
SELECT keys, names, weights
FROM walk
WHERE CAST(:targets AS text[]) IS NULL OR node = ANY(CAST(:targets AS text[]))
"""

_SKILLS_SQL = "SELECT id, skills FROM freelancers WHERE id = ANY(:ids)"

_PROJECTS_SQL = """
SELECT c.freelancer_id, p.id, p.title,
       ARRAY(SELECT DISTINCT lower(s) FROM unnest(p.required_skills) AS s) AS skill_keys
FROM contracts c
JOIN projects p ON p.id = c.project_id
WHERE c.freelancer_id = ANY(:ids)
  AND c.status = :completed
  AND EXISTS (
      SELECT 1 FROM unnest(p.required_skills) AS s WHERE lower(s) = ANY(:required)
  )
"""

# Contracts carry no rating yet, so Postgres collaborations have avg_rating None.
_SHARED_SQL = """
SELECT DISTINCT a.freelancer_id, b.freelancer_id AS other_id, f.name, a.project_id
FROM contracts a
JOIN contracts b ON b.project_id = a.project_id AND b.freelancer_id <> a.freelancer_id
JOIN freelancers f ON f.id = b.freelancer_id
WHERE a.freelancer_id = ANY(:ids)
  AND b.freelancer_id = ANY(:ids)
  AND a.status = :completed
  AND b.status = :completed
"""


def _walk_statement():
    return text(_WALK_SQL).bindparams(
        bindparam("starts", type_=ARRAY(String)),
        bindparam("hops", type_=Integer),
        bindparam("targets", type_=ARRAY(String)),
    )


class PostgresGraphContext:
    source: GraphSource = "postgres"

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _walk(
        self, starts: list[str], hops: int, targets: list[str] | None = None
    ) -> list[RawPath]:
        if not starts or hops < 1 or targets == []:
            return []
        result = await self._session.execute(
            _walk_statement(), {"starts": starts, "hops": int(hops), "targets": targets}
        )
        return [
            RawPath(tuple(keys), tuple(names), tuple(float(w) for w in weights))
            for keys, names, weights in result.all()
        ]

    async def expand_skills(
        self, skills: list[str], *, hops: int | None = None, decay: float | None = None
    ) -> dict[str, dict[str, float]]:
        hops = settings.graph_expansion_hops if hops is None else hops
        decay = settings.graph_expansion_decay if decay is None else decay
        starts = [key for key, _ in normalize_skills(skills)]
        return expansion(best_paths(await self._walk(starts, hops), decay))

    async def candidate_subgraph(
        self,
        freelancer_ids: list[int],
        required_skills: list[str],
        *,
        max_paths: int = 6,
        max_projects: int = 3,
    ) -> dict[int, CandidateGraph]:
        ids = list(dict.fromkeys(int(i) for i in freelancer_ids))
        if not ids:
            return {}
        required = normalize_skills(required_skills)
        required_keys = [key for key, _ in required]

        rows = await self._session.execute(
            text(_SKILLS_SQL).bindparams(bindparam("ids", type_=ARRAY(Integer))), {"ids": ids}
        )
        candidate_skills: dict[int, list[tuple[str, str]]] = {}
        for fid, skills in rows.all():
            candidate_skills[fid] = [(s.lower(), s) for s in (skills or []) if s]

        best = {}
        if required_keys:
            owned = [{k for k, _ in own} for own in candidate_skills.values()]
            missing = sorted({k for k in required_keys for keys in owned if k not in keys})
            targets = sorted({k for own in candidate_skills.values() for k, _ in own})
            paths = await self._walk(missing, settings.graph_expansion_hops, targets)
            best = best_paths(paths, settings.graph_expansion_decay)

        projects: list[ProjectRow] = []
        if required_keys:
            result = await self._session.execute(
                text(_PROJECTS_SQL).bindparams(
                    bindparam("ids", type_=ARRAY(Integer)),
                    bindparam("required", type_=ARRAY(String)),
                ),
                {"ids": ids, "required": required_keys, "completed": model.COMPLETED},
            )
            projects = [
                ProjectRow(fid, pid, title, tuple(keys or ()))
                for fid, pid, title, keys in result.all()
            ]

        shared: list[SharedProjectRow] = []
        if len(ids) > 1:
            result = await self._session.execute(
                text(_SHARED_SQL).bindparams(bindparam("ids", type_=ARRAY(Integer))),
                {"ids": ids, "completed": model.COMPLETED},
            )
            shared = [SharedProjectRow(fid, other, name, pid) for fid, other, name, pid in result.all()]

        return assemble(
            ids,
            required,
            candidate_skills,
            best,
            projects,
            shared,
            max_paths=max_paths,
            max_projects=max_projects,
        )

