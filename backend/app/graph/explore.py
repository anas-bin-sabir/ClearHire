"""Subgraphs for the admin graph page (``GET /graph``), Neo4j or Postgres.

Three views, each returned as ``{nodes, links, source, focus}`` in the
``GraphResponse`` shape:

* overview (no focus): a sample of freelancers, their skills and RELATED_TO edges
* freelancer focus: the freelancer, their skills and 1-hop related skills, the
  projects they worked on (and who posted them), and everyone they completed a
  project with (COLLABORATED_WITH) plus the shared projects
* project focus: the project, its client, required/nice skills and their 1-hop
  related skills, who worked on it, the best-matching freelancers for its required
  skills, and collaborations among every freelancer shown

Node ids: ``f-<id>`` freelancer, ``s-<canonical name>`` skill, ``p-<id>`` project,
``c-<id>`` client. Freelancer nodes carry ``fraud_score``. Neo4j is used when it is
enabled and reachable; on any Neo4j error the Postgres backend answers instead, and
``source`` says which one did. Ratings follow app.graph.sync: WORKED_ON.rating and
COLLABORATED_WITH.avg_rating are null until contracts carry a real rating (a
freelancer's profile rating is not a per-contract rating).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.graph import driver
from app.graph.model import COMPLETED
from app.models.orm import Contract, Freelancer, Project, SkillRelationship, User

logger = logging.getLogger(__name__)


class NotFound(LookupError):
    """The focus freelancer/project doesn't exist."""


@dataclass
class Subgraph:
    source: str
    focus: str | None = None
    nodes: dict[str, dict[str, Any]] = field(default_factory=dict)
    links: dict[tuple[str, str, str], dict[str, Any]] = field(default_factory=dict)

    # --- builders ---

    def freelancer(self, fid: int, name: str | None, fraud_score: float | None) -> str:
        node_id = f"f-{fid}"
        self.nodes.setdefault(
            node_id,
            {"id": node_id, "name": name or f"Freelancer {fid}", "type": "freelancer",
             "fraud_score": None if fraud_score is None else round(float(fraud_score), 4)},
        )
        return node_id

    def skill(self, name: str) -> str:
        node_id = f"s-{name}"
        self.nodes.setdefault(node_id, {"id": node_id, "name": name, "type": "skill"})
        return node_id

    def project(self, pid: int, title: str | None) -> str:
        node_id = f"p-{pid}"
        self.nodes.setdefault(
            node_id, {"id": node_id, "name": title or f"Project {pid}", "type": "project"}
        )
        return node_id

    def client(self, cid: int, name: str | None) -> str:
        node_id = f"c-{cid}"
        self.nodes.setdefault(
            node_id, {"id": node_id, "name": name or f"Client {cid}", "type": "client"}
        )
        return node_id

    def link(self, source: str, target: str, type_: str, weight: float | None = None,
             **properties: Any) -> None:
        if type_ in ("RELATED_TO", "COLLABORATED_WITH") and source > target:
            source, target = target, source  # undirected: one link per pair
        key = (source, target, type_)
        if key in self.links:
            return
        props = {k: v for k, v in properties.items() if v is not None}
        self.links[key] = {
            "source": source, "target": target, "type": type_,
            "weight": None if weight is None else round(float(weight), 4),
            "properties": props,
        }

    def to_dict(self) -> dict[str, Any]:
        # Drop links whose endpoints were never added (defensive; keeps D3 happy).
        links = [l for l in self.links.values() if l["source"] in self.nodes and l["target"] in self.nodes]
        return {
            "nodes": list(self.nodes.values()),
            "links": links,
            "source": self.source,
            "focus": self.focus,
        }


# --- Postgres ----------------------------------------------------------------


class PostgresExplorer:
    source = "postgres"

    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def _related(self, skills: list[str], limit: int) -> list[tuple[str, str, float]]:
        if not skills:
            return []
        lowered = [s.lower() for s in skills]
        rows = await self._s.execute(
            select(SkillRelationship.skill_a, SkillRelationship.skill_b, SkillRelationship.weight)
            .where(or_(func.lower(SkillRelationship.skill_a).in_(lowered),
                       func.lower(SkillRelationship.skill_b).in_(lowered)))
            .order_by(SkillRelationship.weight.desc(), SkillRelationship.id)
            .limit(limit)
        )
        return [(a, b, float(w)) for a, b, w in rows.all()]

    async def _collaborations(
        self, ids: list[int], *, anchor: int | None = None
    ) -> list[tuple[int, int, list[int]]]:
        """(a, b, shared completed project ids) for a<b; both in ``ids`` or one == anchor."""
        a, b = aliased(Contract), aliased(Contract)
        stmt = (
            select(a.freelancer_id, b.freelancer_id, func.array_agg(func.distinct(a.project_id)))
            .join(b, and_(a.project_id == b.project_id, a.freelancer_id < b.freelancer_id))
            .where(a.status == COMPLETED, b.status == COMPLETED)
            .group_by(a.freelancer_id, b.freelancer_id)
        )
        if anchor is not None:
            stmt = stmt.where(or_(a.freelancer_id == anchor, b.freelancer_id == anchor))
        else:
            stmt = stmt.where(a.freelancer_id.in_(ids), b.freelancer_id.in_(ids))
        return [(x, y, sorted(p)) for x, y, p in (await self._s.execute(stmt)).all()]

    async def _freelancers(self, ids: set[int]) -> dict[int, Freelancer]:
        if not ids:
            return {}
        rows = await self._s.execute(select(Freelancer).where(Freelancer.id.in_(ids)))
        return {f.id: f for f in rows.scalars()}

    async def overview(self, limit: int) -> Subgraph:
        g = Subgraph(self.source)
        rows = await self._s.execute(
            select(Freelancer.id, Freelancer.name, Freelancer.skills, Freelancer.fraud_score)
            .order_by(Freelancer.id).limit(limit)
        )
        for fid, name, skills, fraud in rows.all():
            node = g.freelancer(fid, name, fraud)
            for skill in skills or []:
                g.link(node, g.skill(skill), "HAS_SKILL")
        names = {n["name"].lower(): n["name"] for n in g.nodes.values() if n["type"] == "skill"}
        for rel in (await self._s.execute(select(SkillRelationship))).scalars():
            a, b = names.get(rel.skill_a.lower()), names.get(rel.skill_b.lower())
            if a and b:
                g.link(f"s-{a}", f"s-{b}", "RELATED_TO", rel.weight)
        return g

    async def around_freelancer(self, freelancer_id: int, limit: int) -> Subgraph:
        focus = (await self._freelancers({freelancer_id})).get(freelancer_id)
        if focus is None:
            raise NotFound(f"freelancer {freelancer_id} not found")
        g = Subgraph(self.source)
        center = g.focus = g.freelancer(focus.id, focus.name, focus.fraud_score)
        skills = list(focus.skills or [])
        for skill in skills:
            g.link(center, g.skill(skill), "HAS_SKILL", level=focus.experience_years)
        for a, b, w in await self._related(skills, limit):
            g.link(g.skill(a), g.skill(b), "RELATED_TO", w)

        worked = await self._s.execute(
            select(Project.id, Project.title, Contract.status, User.id, User.name)
            .join(Contract, Contract.project_id == Project.id)
            .outerjoin(User, User.id == Project.client_id)
            .where(Contract.freelancer_id == focus.id)
            .order_by(Contract.created_at.desc())
            .limit(limit)
        )
        for pid, title, status, cid, cname in worked.all():
            node = g.project(pid, title)
            g.link(center, node, "WORKED_ON", status=status,
                   rating=None)
            if cid is not None:
                g.link(g.client(cid, cname), node, "POSTED")

        collabs = (await self._collaborations([], anchor=focus.id))[:limit]
        others = await self._freelancers({x if y == focus.id else y for x, y, _ in collabs})
        titles = await self._titles({p for _, _, ps in collabs for p in ps})
        for x, y, projects in collabs:
            other = others.get(y if x == focus.id else x)
            if other is None:
                continue
            onode = g.freelancer(other.id, other.name, other.fraud_score)
            g.link(center, onode, "COLLABORATED_WITH", count=len(projects),
                   avg_rating=None, project_ids=projects)
            for pid in projects:
                pnode = g.project(pid, titles.get(pid))
                g.link(center, pnode, "WORKED_ON", status=COMPLETED, rating=None)
                g.link(onode, pnode, "WORKED_ON", status=COMPLETED, rating=None)
        return g

    async def _titles(self, ids: set[int]) -> dict[int, str | None]:
        if not ids:
            return {}
        rows = await self._s.execute(select(Project.id, Project.title).where(Project.id.in_(ids)))
        return dict(rows.all())

    async def around_project(self, project_id: int, limit: int) -> Subgraph:
        row = (
            await self._s.execute(
                select(Project, User.name).outerjoin(User, User.id == Project.client_id)
                .where(Project.id == project_id)
            )
        ).first()
        if row is None:
            raise NotFound(f"project {project_id} not found")
        project, client_name = row
        g = Subgraph(self.source)
        center = g.focus = g.project(project.id, project.title)
        if project.client_id is not None:
            g.link(g.client(project.client_id, client_name), center, "POSTED")
        must = list(project.required_skills or [])
        nice = [s for s in project.nice_to_have_skills or [] if s not in must]
        for skill in must:
            g.link(center, g.skill(skill), "REQUIRES", importance="must")
        for skill in nice:
            g.link(center, g.skill(skill), "REQUIRES", importance="nice")
        for a, b, w in await self._related(must + nice, limit):
            g.link(g.skill(a), g.skill(b), "RELATED_TO", w)

        shown: dict[int, Freelancer] = {}
        workers = await self._s.execute(
            select(Freelancer, Contract.status)
            .join(Contract, Contract.freelancer_id == Freelancer.id)
            .where(Contract.project_id == project.id)
        )
        for freelancer, status in workers.all():
            shown[freelancer.id] = freelancer
            g.link(g.freelancer(freelancer.id, freelancer.name, freelancer.fraud_score), center,
                   "WORKED_ON", status=status,
                   rating=None)

        wanted = must or nice
        if wanted:
            wanted_lower = {w.lower() for w in wanted}
            pool = list(
                (
                    await self._s.execute(
                        select(Freelancer).where(Freelancer.skills.overlap(wanted))
                        .order_by(Freelancer.rating.desc(), Freelancer.id)
                        .limit(limit * 5)
                    )
                ).scalars()
            )
            pool.sort(key=lambda f: (
                -sum(1 for s in f.skills or [] if s.lower() in wanted_lower),
                -(f.rating or 0.0), f.id,
            ))
            for freelancer in pool[:limit]:
                shown.setdefault(freelancer.id, freelancer)
        wanted_keys = {s.lower(): s for s in must + nice}
        for freelancer in shown.values():
            node = g.freelancer(freelancer.id, freelancer.name, freelancer.fraud_score)
            for skill in freelancer.skills or []:
                if skill.lower() in wanted_keys:
                    g.link(node, g.skill(wanted_keys[skill.lower()]), "HAS_SKILL",
                           level=freelancer.experience_years)

        for x, y, projects in await self._collaborations(list(shown)):
            g.link(f"f-{x}", f"f-{y}", "COLLABORATED_WITH", count=len(projects),
                   avg_rating=None, project_ids=projects)
        return g


# --- Neo4j -------------------------------------------------------------------


class Neo4jExplorer:
    source = "neo4j"

    async def overview(self, limit: int) -> Subgraph:
        g = Subgraph(self.source)
        rows = await driver.run(
            "MATCH (f:Freelancer) WITH f ORDER BY f.id LIMIT $limit "
            "OPTIONAL MATCH (f)-[:HAS_SKILL]->(s:Skill) "
            "RETURN f.id AS id, f.name AS name, f.fraud_score AS fraud, collect(s.name) AS skills "
            "ORDER BY id",
            limit=limit,
        )
        for r in rows:
            node = g.freelancer(r["id"], r["name"], r["fraud"])
            for skill in r["skills"]:
                g.link(node, g.skill(skill), "HAS_SKILL")
        names = [n["name"] for n in g.nodes.values() if n["type"] == "skill"]
        for r in await driver.run(
            "MATCH (a:Skill)-[r:RELATED_TO]-(b:Skill) "
            "WHERE a.name IN $names AND b.name IN $names AND a.key < b.key "
            "RETURN a.name AS a, b.name AS b, r.weight AS w",
            names=names,
        ):
            g.link(f"s-{r['a']}", f"s-{r['b']}", "RELATED_TO", r["w"])
        return g

    async def _related(self, g: Subgraph, skills: list[str], limit: int) -> None:
        for r in await driver.run(
            "MATCH (s:Skill)-[r:RELATED_TO]-(t:Skill) WHERE s.key IN $keys "
            "RETURN s.name AS a, t.name AS b, r.weight AS w ORDER BY w DESC, a, b LIMIT $limit",
            keys=[s.lower() for s in skills], limit=limit,
        ):
            g.link(g.skill(r["a"]), g.skill(r["b"]), "RELATED_TO", r["w"])

    async def around_freelancer(self, freelancer_id: int, limit: int) -> Subgraph:
        rows = await driver.run(
            "MATCH (f:Freelancer {id: $id}) OPTIONAL MATCH (f)-[h:HAS_SKILL]->(s:Skill) "
            "RETURN f.name AS name, f.fraud_score AS fraud, f.rating AS rating, "
            "collect({name: s.name, level: h.level}) AS skills",
            id=freelancer_id,
        )
        if not rows:
            raise NotFound(f"freelancer {freelancer_id} not found")
        f = rows[0]
        g = Subgraph(self.source)
        center = g.focus = g.freelancer(freelancer_id, f["name"], f["fraud"])
        skills = [s["name"] for s in f["skills"] if s["name"]]
        for s in f["skills"]:
            if s["name"]:
                g.link(center, g.skill(s["name"]), "HAS_SKILL", level=s["level"])
        await self._related(g, skills, limit)

        for r in await driver.run(
            "MATCH (f:Freelancer {id: $id})-[w:WORKED_ON]->(p:Project) "
            "OPTIONAL MATCH (c:Client)-[:POSTED]->(p) "
            "RETURN p.id AS pid, p.title AS title, w.status AS status, w.rating AS rating, "
            "c.id AS cid, c.name AS cname ORDER BY pid DESC LIMIT $limit",
            id=freelancer_id, limit=limit,
        ):
            node = g.project(r["pid"], r["title"])
            g.link(center, node, "WORKED_ON", status=r["status"], rating=r["rating"])
            if r["cid"] is not None:
                g.link(g.client(r["cid"], r["cname"]), node, "POSTED")

        for r in await driver.run(
            "MATCH (f:Freelancer {id: $id})-[c:COLLABORATED_WITH]-(o:Freelancer) "
            "WITH f, c, o ORDER BY c.count DESC, o.id LIMIT $limit "
            "OPTIONAL MATCH (f)-[w1:WORKED_ON {status: $completed}]->(p:Project)"
            "<-[w2:WORKED_ON {status: $completed}]-(o) "
            "RETURN o.id AS oid, o.name AS name, o.fraud_score AS fraud, c.count AS count, "
            "c.avg_rating AS avg_rating, "
            "collect({id: p.id, title: p.title, r1: w1.rating, r2: w2.rating}) AS projects",
            id=freelancer_id, limit=limit, completed=COMPLETED,
        ):
            onode = g.freelancer(r["oid"], r["name"], r["fraud"])
            projects = [p for p in r["projects"] if p["id"] is not None]
            g.link(center, onode, "COLLABORATED_WITH", count=r["count"],
                   avg_rating=r["avg_rating"], project_ids=sorted(p["id"] for p in projects))
            for p in projects:
                pnode = g.project(p["id"], p["title"])
                g.link(center, pnode, "WORKED_ON", status=COMPLETED, rating=p["r1"])
                g.link(onode, pnode, "WORKED_ON", status=COMPLETED, rating=p["r2"])
        return g

    async def around_project(self, project_id: int, limit: int) -> Subgraph:
        rows = await driver.run(
            "MATCH (p:Project {id: $id}) OPTIONAL MATCH (c:Client)-[:POSTED]->(p) "
            "OPTIONAL MATCH (p)-[r:REQUIRES]->(s:Skill) "
            "RETURN p.title AS title, c.id AS cid, c.name AS cname, "
            "collect({name: s.name, importance: r.importance}) AS skills",
            id=project_id,
        )
        if not rows:
            raise NotFound(f"project {project_id} not found")
        p = rows[0]
        g = Subgraph(self.source)
        center = g.focus = g.project(project_id, p["title"])
        if p["cid"] is not None:
            g.link(g.client(p["cid"], p["cname"]), center, "POSTED")
        required = [s for s in p["skills"] if s["name"]]
        for s in required:
            g.link(center, g.skill(s["name"]), "REQUIRES", importance=s["importance"])
        await self._related(g, [s["name"] for s in required], limit)

        ids: set[int] = set()
        for r in await driver.run(
            "MATCH (f:Freelancer)-[w:WORKED_ON]->(:Project {id: $id}) "
            "RETURN f.id AS fid, f.name AS name, f.fraud_score AS fraud, "
            "w.status AS status, w.rating AS rating",
            id=project_id,
        ):
            ids.add(r["fid"])
            g.link(g.freelancer(r["fid"], r["name"], r["fraud"]), center, "WORKED_ON",
                   status=r["status"], rating=r["rating"])
        wanted = [s["name"] for s in required if s["importance"] == "must"] or [
            s["name"] for s in required
        ]
        for r in await driver.run(
            "MATCH (s:Skill)<-[h:HAS_SKILL]-(f:Freelancer) WHERE s.key IN $keys "
            "WITH f, collect({name: s.name, level: h.level}) AS skills "
            "RETURN f.id AS fid, f.name AS name, f.fraud_score AS fraud, skills "
            "ORDER BY size(skills) DESC, f.rating DESC, fid LIMIT $limit",
            keys=[w.lower() for w in wanted], limit=limit,
        ):
            ids.add(r["fid"])
            g.freelancer(r["fid"], r["name"], r["fraud"])
        if ids:
            for r in await driver.run(
                "MATCH (f:Freelancer)-[h:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(:Project {id: $id}) "
                "WHERE f.id IN $ids RETURN f.id AS fid, s.name AS skill, h.level AS level",
                id=project_id, ids=sorted(ids),
            ):
                g.link(f"f-{r['fid']}", g.skill(r["skill"]), "HAS_SKILL", level=r["level"])
            for r in await driver.run(
                "MATCH (a:Freelancer)-[c:COLLABORATED_WITH]-(b:Freelancer) "
                "WHERE a.id IN $ids AND b.id IN $ids AND a.id < b.id "
                "OPTIONAL MATCH (a)-[:WORKED_ON {status: $completed}]->(p:Project)"
                "<-[:WORKED_ON {status: $completed}]-(b) "
                "RETURN a.id AS a, b.id AS b, c.count AS count, c.avg_rating AS avg_rating, "
                "collect(p.id) AS projects",
                ids=sorted(ids), completed=COMPLETED,
            ):
                g.link(f"f-{r['a']}", f"f-{r['b']}", "COLLABORATED_WITH", count=r["count"],
                       avg_rating=r["avg_rating"], project_ids=sorted(r["projects"]))
        return g


# --- Entry point -------------------------------------------------------------


async def explore(
    session: AsyncSession,
    *,
    freelancer_id: int | None = None,
    project_id: int | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    """Subgraph dict for GraphResponse. Raises NotFound for an unknown focus."""

    async def run(explorer) -> Subgraph:
        if freelancer_id is not None:
            return await explorer.around_freelancer(freelancer_id, limit)
        if project_id is not None:
            return await explorer.around_project(project_id, limit)
        return await explorer.overview(limit)

    if driver.is_enabled() and await driver.ping() == "ok":
        try:
            return (await run(Neo4jExplorer())).to_dict()
        except Exception as exc:  # noqa: BLE001 - fall back to the authoritative store
            # NotFound included: the read model may lag the outbox; Postgres decides.
            logger.warning("neo4j graph explore failed, using postgres: %s", exc)
    return (await run(PostgresExplorer(session))).to_dict()
