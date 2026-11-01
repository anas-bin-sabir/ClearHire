"""GraphRAG context: the one interface the rest of the app uses for graph facts.

Two backends implement ``GraphContext``:
  * ``Neo4jGraphContext``    - Cypher over the derived read model (app.graph.model)
  * ``PostgresGraphContext`` - recursive CTEs over skill_relationships / contracts

``get_graph_context(session)`` picks Neo4j when it is enabled and reachable and
falls back to Postgres otherwise, so callers never branch on the backend.
Both backends must return identical shapes (and, on the same data, the same facts).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

GraphSource = Literal["neo4j", "postgres"]


@dataclass(frozen=True)
class SkillPath:
    """How a candidate reaches a required skill: [have, ..., required]."""

    required: str            # canonical required skill
    via: str                 # the candidate's own skill the path starts from
    hops: int                # 0 = has it, 1 = directly related, 2 = two hops
    weight: float            # product of RELATED_TO weights * decay per extra hop
    path: list[str]          # canonical names, candidate skill first


@dataclass(frozen=True)
class PastProject:
    id: int
    title: str
    shared_skills: list[str]  # required skills of *this* search the project also needed


@dataclass(frozen=True)
class Collaboration:
    other_id: int            # another freelancer in the same shortlist
    other_name: str
    project_ids: list[int]   # completed projects both worked on
    count: int
    avg_rating: float | None


@dataclass
class CandidateGraph:
    freelancer_id: int
    skill_paths: list[SkillPath] = field(default_factory=list)
    past_projects: list[PastProject] = field(default_factory=list)
    collaborations: list[Collaboration] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not (self.skill_paths or self.past_projects or self.collaborations)


class GraphContext(Protocol):
    source: GraphSource

    async def expand_skills(
        self, skills: list[str], *, hops: int | None = None, decay: float | None = None
    ) -> dict[str, dict[str, float]]:
        """Multi-hop adjacency for the given skills.

        Returns ``{required_lower: {related_lower: weight}}`` in the same shape as
        ``SkillRelationshipRepository.adjacency()`` so ranking can use it directly.
        1-hop weight = edge weight; each further hop multiplies the edge weights
        along the path and by ``decay`` once per extra hop; the best path wins.
        The skill itself is not included. Defaults come from settings.
        """
        ...

    async def candidate_subgraph(
        self,
        freelancer_ids: list[int],
        required_skills: list[str],
        *,
        max_paths: int = 6,
        max_projects: int = 3,
    ) -> dict[int, CandidateGraph]:
        """Graph facts for a shortlist, keyed by freelancer id (every id present).

        * skill_paths: for each required skill the candidate lacks, the best path
          from one of their skills (hops <= settings.graph_expansion_hops); for
          skills they have, a 0-hop path. At most ``max_paths`` per candidate.
        * past_projects: completed projects whose required skills overlap
          ``required_skills``, most overlap first, at most ``max_projects``.
        * collaborations: other ids *in freelancer_ids* who completed a project
          with this candidate.
        """
        ...


async def get_graph_context(session: AsyncSession) -> GraphContext:
    """Neo4j when enabled and reachable, else the Postgres fallback."""
    from app.graph import driver
    from app.graph.postgres_context import PostgresGraphContext

    if driver.is_enabled() and await driver.ping() == "ok":
        from app.graph.neo4j_context import Neo4jGraphContext

        return Neo4jGraphContext()
    return PostgresGraphContext(session)


def subgraph_to_prompt(graph: CandidateGraph) -> dict:
    """Compact JSON-able form for LLM prompts and API responses."""
    return {
        "skill_paths": [
            {"required": p.required, "via": p.via, "hops": p.hops,
             "weight": round(p.weight, 3), "path": p.path}
            for p in graph.skill_paths
        ],
        "past_projects": [
            {"id": p.id, "title": p.title, "shared_skills": p.shared_skills}
            for p in graph.past_projects
        ],
        "collaborations": [
            {"other_id": c.other_id, "other_name": c.other_name,
             "project_ids": c.project_ids, "count": c.count,
             "avg_rating": None if c.avg_rating is None else round(c.avg_rating, 2)}
            for c in graph.collaborations
        ],
    }
