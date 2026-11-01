"""Backend-neutral assembly of GraphRAG facts.

Both ``PostgresGraphContext`` and ``Neo4jGraphContext`` fetch *raw* rows (simple
skill paths with their edge weights, completed projects, shared projects) and hand
them to the functions here. All scoring, tie-breaking, ordering and truncation
happens in this module, so the two backends return identical results whenever
they see the same data, down to the float bits of every weight.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from app.ai.skill_taxonomy import canonicalize
from app.graph.context import CandidateGraph, Collaboration, PastProject, SkillPath


@dataclass(frozen=True)
class RawPath:
    """A simple (cycle-free) RELATED_TO path, starting at the queried skill."""

    keys: tuple[str, ...]       # lower-cased skill keys, start first
    names: tuple[str, ...]      # display names, same order
    weights: tuple[float, ...]  # edge weights, len(keys) - 1


@dataclass(frozen=True)
class BestPath:
    weight: float
    hops: int
    keys: tuple[str, ...]
    names: tuple[str, ...]

    def sort_key(self) -> tuple[float, int, tuple[str, ...]]:
        # Highest weight, then fewest hops, then lexicographic keys: total order.
        return (-self.weight, self.hops, self.keys)


@dataclass(frozen=True)
class ProjectRow:
    freelancer_id: int
    project_id: int
    title: str | None
    skill_keys: tuple[str, ...]  # lower-cased required skills of that project


@dataclass(frozen=True)
class SharedProjectRow:
    freelancer_id: int
    other_id: int
    other_name: str | None
    project_id: int
    ratings: tuple[float, ...] = ()  # WORKED_ON ratings on that project, if any


def normalize_skills(skills: Iterable[str]) -> list[tuple[str, str]]:
    """Canonical (key, display) pairs, de-duplicated, input order kept."""
    seen: set[str] = set()
    result: list[tuple[str, str]] = []
    for raw in skills:
        if not raw or not raw.strip():
            continue
        name = canonicalize(raw)
        key = name.lower()
        if key not in seen:
            seen.add(key)
            result.append((key, name))
    return result


def path_weight(weights: Sequence[float], decay: float) -> float:
    """Product of edge weights times ``decay`` once per hop beyond the first."""
    weight = 1.0
    for w in weights:
        weight *= float(w)
    return weight * decay ** (len(weights) - 1)


def best_paths(paths: Iterable[RawPath], decay: float) -> dict[tuple[str, str], BestPath]:
    """Best path per (start, end) pair; cycles and self-loops are ignored."""
    best: dict[tuple[str, str], BestPath] = {}
    for raw in paths:
        keys = tuple(raw.keys)
        if len(keys) < 2 or len(set(keys)) != len(keys) or len(raw.weights) != len(keys) - 1:
            continue
        candidate = BestPath(
            weight=path_weight(raw.weights, decay),
            hops=len(keys) - 1,
            keys=keys,
            names=tuple(raw.names),
        )
        pair = (keys[0], keys[-1])
        current = best.get(pair)
        if current is None or candidate.sort_key() < current.sort_key():
            best[pair] = candidate
    return best


def expansion(best: dict[tuple[str, str], BestPath]) -> dict[str, dict[str, float]]:
    """``{start: {end: weight}}`` in the shape of SkillRelationshipRepository.adjacency()."""
    result: dict[str, dict[str, float]] = {}
    for (start, end), path in sorted(best.items()):
        result.setdefault(start, {})[end] = path.weight
    return result


def assemble(
    freelancer_ids: list[int],
    required: list[tuple[str, str]],
    candidate_skills: dict[int, list[tuple[str, str]]],
    best: dict[tuple[str, str], BestPath],
    projects: Iterable[ProjectRow],
    shared: Iterable[SharedProjectRow],
    *,
    max_paths: int,
    max_projects: int,
) -> dict[int, CandidateGraph]:
    """Turn raw backend rows into ``{freelancer_id: CandidateGraph}`` (every id present).

    ``required`` is ``normalize_skills(required_skills)``; ``best`` holds paths that
    start at a required key; ``candidate_skills`` maps id -> [(key, display name)].
    """
    graphs = {fid: CandidateGraph(freelancer_id=fid) for fid in freelancer_ids}

    for fid, graph in graphs.items():
        own = dict(candidate_skills.get(fid, []))
        paths: list[SkillPath] = []
        for req_key, req_name in required:
            if req_key in own:
                paths.append(SkillPath(req_name, own[req_key], 0, 1.0, [own[req_key]]))
                continue
            options = [best[(req_key, k)] for k in own if (req_key, k) in best]
            if not options:
                continue
            chosen = min(options, key=BestPath.sort_key)
            names = list(reversed(chosen.names))  # candidate skill first
            via = own.get(chosen.keys[-1], names[0])
            names[0] = via
            names[-1] = req_name
            paths.append(SkillPath(req_name, via, chosen.hops, chosen.weight, names))
        graph.skill_paths = paths[:max_paths]

    by_freelancer: dict[int, dict[int, PastProject]] = {}
    overlap: dict[tuple[int, int], int] = {}
    for row in projects:
        if row.freelancer_id not in graphs:
            continue
        keys = set(row.skill_keys)
        shared_names = [name for key, name in required if key in keys]
        if not shared_names:
            continue
        title = row.title or f"Project {row.project_id}"
        by_freelancer.setdefault(row.freelancer_id, {})[row.project_id] = PastProject(
            row.project_id, title, shared_names
        )
        overlap[(row.freelancer_id, row.project_id)] = len(shared_names)
    for fid, items in by_freelancer.items():
        ordered = sorted(
            items.values(), key=lambda p: (-overlap[(fid, p.id)], -p.id)
        )
        graphs[fid].past_projects = ordered[:max_projects]

    pairs: dict[tuple[int, int], dict] = {}
    for row in shared:
        if row.freelancer_id == row.other_id:
            continue
        if row.freelancer_id not in graphs or row.other_id not in graphs:
            continue
        entry = pairs.setdefault(
            (row.freelancer_id, row.other_id),
            {"name": row.other_name, "projects": set(), "ratings": {}},
        )
        entry["projects"].add(row.project_id)
        entry["ratings"].setdefault(
            row.project_id, tuple(sorted(float(r) for r in row.ratings if r is not None))
        )
    for (fid, other), entry in pairs.items():
        project_ids = sorted(entry["projects"])
        ratings = [r for pid in project_ids for r in entry["ratings"].get(pid, ())]
        graphs[fid].collaborations.append(
            Collaboration(
                other_id=other,
                other_name=entry["name"] or f"Freelancer {other}",
                project_ids=project_ids,
                count=len(project_ids),
                avg_rating=(sum(ratings) / len(ratings)) if ratings else None,
            )
        )
    for graph in graphs.values():
        graph.collaborations.sort(key=lambda c: (-c.count, c.other_id))
    return graphs
