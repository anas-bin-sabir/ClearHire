"""GraphContext over the Neo4j read model (labels and edges from app.graph.model).

Each call runs a fixed number of Cypher queries (expand_skills: 1;
candidate_subgraph: at most 4). The queries return raw rows; scoring,
tie-breaking and ordering live in app.graph.paths, shared with the Postgres
backend, so both return the same facts for the same data.
"""

from __future__ import annotations

from app.core.config import settings
from app.graph import driver, model
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

# Every simple RELATED_TO path (undirected, 1..hops edges) from a start key.
# Cypher's variable-length match never reuses a relationship but may revisit a
# node, so the WHERE clause rejects paths with a repeated node (cycles).
_WALK_CYPHER = f"""
MATCH p = (s:{model.SKILL})-[:{model.RELATED_TO}*1..{{hops}}]-(t:{model.SKILL})
WHERE s.key IN $starts
  AND ($targets IS NULL OR t.key IN $targets)
  AND all(i IN range(0, size(nodes(p)) - 2) WHERE NOT nodes(p)[i] IN nodes(p)[i + 1..])
RETURN [n IN nodes(p) | n.key] AS keys,
       [n IN nodes(p) | coalesce(n.name, n.key)] AS names,
       [r IN relationships(p) | toFloat(coalesce(r.weight, 0.5))] AS weights
"""

_SKILLS_CYPHER = f"""
MATCH (f:{model.FREELANCER})-[:{model.HAS_SKILL}]->(s:{model.SKILL})
WHERE f.id IN $ids
RETURN f.id AS id, s.key AS key, coalesce(s.name, s.key) AS name
ORDER BY id, key
"""

# Required (importance "must") skills of completed projects that overlap the search.
_PROJECTS_CYPHER = f"""
MATCH (f:{model.FREELANCER})-[w:{model.WORKED_ON}]->(p:{model.PROJECT})
WHERE f.id IN $ids AND w.status = $completed
MATCH (p)-[r:{model.REQUIRES}]->(s:{model.SKILL})
WHERE coalesce(r.importance, 'must') = 'must'
WITH f, p, collect(DISTINCT s.key) AS keys
WHERE any(k IN keys WHERE k IN $required)
RETURN f.id AS freelancer_id, p.id AS project_id, p.title AS title, keys
"""

_SHARED_CYPHER = f"""
MATCH (a:{model.FREELANCER})-[wa:{model.WORKED_ON}]->(p:{model.PROJECT})
      <-[wb:{model.WORKED_ON}]-(b:{model.FREELANCER})
WHERE a.id IN $ids AND b.id IN $ids AND a.id <> b.id
  AND wa.status = $completed AND wb.status = $completed
RETURN a.id AS freelancer_id, b.id AS other_id, b.name AS other_name,
       p.id AS project_id, [x IN [wa.rating, wb.rating] WHERE x IS NOT NULL] AS ratings
"""


class Neo4jGraphContext:
    source: GraphSource = "neo4j"

    async def _walk(
        self, starts: list[str], hops: int, targets: list[str] | None = None
    ) -> list[RawPath]:
        if not starts or hops < 1 or targets == []:
            return []
        # Cypher cannot parameterize a variable-length bound; hops is an int.
        query = _WALK_CYPHER.replace("{hops}", str(int(hops)))
        rows = await driver.run(query, starts=starts, targets=targets)
        return [
            RawPath(tuple(r["keys"]), tuple(r["names"]), tuple(float(w) for w in r["weights"]))
            for r in rows
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

        candidate_skills: dict[int, list[tuple[str, str]]] = {}
        for row in await driver.run(_SKILLS_CYPHER, ids=ids):
            candidate_skills.setdefault(row["id"], []).append((row["key"], row["name"]))

        best = {}
        if required_keys:
            owned = [{k for k, _ in own} for own in candidate_skills.values()]
            missing = sorted({k for k in required_keys for keys in owned if k not in keys})
            targets = sorted({k for own in candidate_skills.values() for k, _ in own})
            paths = await self._walk(missing, settings.graph_expansion_hops, targets)
            best = best_paths(paths, settings.graph_expansion_decay)

        projects: list[ProjectRow] = []
        if required_keys:
            rows = await driver.run(
                _PROJECTS_CYPHER, ids=ids, required=required_keys, completed=model.COMPLETED
            )
            projects = [
                ProjectRow(r["freelancer_id"], r["project_id"], r["title"], tuple(r["keys"]))
                for r in rows
            ]

        shared: list[SharedProjectRow] = []
        if len(ids) > 1:
            rows = await driver.run(_SHARED_CYPHER, ids=ids, completed=model.COMPLETED)
            shared = [
                SharedProjectRow(
                    r["freelancer_id"], r["other_id"], r["other_name"], r["project_id"],
                    tuple(r["ratings"]),
                )
                for r in rows
            ]

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
