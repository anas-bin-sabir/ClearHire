from typing import Any

from app.db.neo4j_client import get_neo4j_driver
from app.models.schemas import GraphLink, GraphNode, GraphResponse

SKILL_ONTOLOGY: list[tuple[str, str]] = [
    ("React", "Frontend"),
    ("Next.js", "Frontend"),
    ("Vue", "Frontend"),
    ("Node.js", "Backend"),
    ("FastAPI", "Backend"),
    ("Django", "Backend"),
    ("PostgreSQL", "Database"),
    ("MongoDB", "Database"),
    ("Neo4j", "Database"),
    ("Python", "General"),
    ("JavaScript", "General"),
    ("TypeScript", "General"),
    ("PyTorch", "ML"),
    ("TensorFlow", "ML"),
    ("scikit-learn", "ML"),
    ("ML", "ML"),
    ("Docker", "DevOps"),
    ("Kubernetes", "DevOps"),
    ("AWS", "DevOps"),
    ("Data Science", "ML"),
    ("DevOps", "DevOps"),
    ("UI/UX", "Design"),
    ("Figma", "Design"),
]

SKILL_RELATIONS: list[tuple[str, str]] = [
    ("React", "JavaScript"),
    ("Next.js", "React"),
    ("Vue", "JavaScript"),
    ("TypeScript", "JavaScript"),
    ("FastAPI", "Python"),
    ("Django", "Python"),
    ("PyTorch", "Python"),
    ("TensorFlow", "Python"),
    ("Node.js", "JavaScript"),
    ("ML", "Python"),
    ("Data Science", "Python"),
    ("DevOps", "Docker"),
    ("PostgreSQL", "Node.js"),
]


class GraphRepository:
    """Neo4j graph: Freelancer, Skill, Project nodes and relationship types."""

    async def ensure_constraints(self) -> None:
        driver = get_neo4j_driver()
        statements = [
            "CREATE CONSTRAINT freelancer_id IF NOT EXISTS FOR (f:Freelancer) REQUIRE f.id IS UNIQUE",
            "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE",
            "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE",
        ]
        async with driver.session() as session:
            for stmt in statements:
                await session.run(stmt)

    async def seed_skill_ontology(self) -> None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            for skill_name, category in SKILL_ONTOLOGY:
                await session.run(
                    "MERGE (s:Skill {name: $name}) SET s.category = $category",
                    name=skill_name,
                    category=category,
                )
            for skill_a, skill_b in SKILL_RELATIONS:
                await session.run(
                    """
                    MATCH (a:Skill {name: $a}), (b:Skill {name: $b})
                    MERGE (a)-[:RELATED_TO]->(b)
                    """,
                    a=skill_a,
                    b=skill_b,
                )

    async def merge_freelancer(
        self,
        *,
        freelancer_id: int,
        name: str,
        skills: list[str],
        referred_by_id: int | None = None,
    ) -> None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                MERGE (f:Freelancer {id: $id})
                SET f.name = $name
                """,
                id=freelancer_id,
                name=name,
            )
            for skill in skills:
                await session.run(
                    """
                    MERGE (s:Skill {name: $skill})
                    WITH s
                    MATCH (f:Freelancer {id: $fid})
                    MERGE (f)-[:HAS_SKILL]->(s)
                    """,
                    skill=skill,
                    fid=freelancer_id,
                )
            if referred_by_id is not None:
                await session.run(
                    """
                    MATCH (f:Freelancer {id: $fid}), (ref:Freelancer {id: $ref_id})
                    MERGE (f)-[:REFERRED_BY]->(ref)
                    """,
                    fid=freelancer_id,
                    ref_id=referred_by_id,
                )

    async def merge_project(
        self,
        *,
        project_id: int,
        title: str,
        required_skills: list[str],
    ) -> None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                MERGE (p:Project {id: $id})
                SET p.title = $title
                """,
                id=project_id,
                title=title,
            )
            for skill in required_skills:
                await session.run(
                    """
                    MERGE (s:Skill {name: $skill})
                    WITH s
                    MATCH (p:Project {id: $pid})
                    MERGE (p)-[:REQUIRES_SKILL]->(s)
                    """,
                    skill=skill,
                    pid=project_id,
                )

    async def link_worked_on(
        self,
        *,
        freelancer_id: int,
        project_id: int,
        status: str = "active",
    ) -> None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (f:Freelancer {id: $fid}), (p:Project {id: $pid})
                MERGE (f)-[r:WORKED_ON]->(p)
                SET r.status = $status
                """,
                fid=freelancer_id,
                pid=project_id,
                status=status,
            )

    async def fetch_related_skill_edges(self) -> list[dict[str, Any]]:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (a:Skill)-[r:RELATED_TO]->(b:Skill)
                RETURN a.name AS source, b.name AS target, type(r) AS rel_type
                """
            )
            return await result.data()

    async def fetch_full_graph(self, limit: int = 30) -> GraphResponse:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (f:Freelancer)
                OPTIONAL MATCH (f)-[hs:HAS_SKILL]->(s:Skill)
                OPTIONAL MATCH (f)-[wo:WORKED_ON]->(p:Project)
                OPTIONAL MATCH (f)-[ref:REFERRED_BY]->(referrer:Freelancer)
                OPTIONAL MATCH (s1:Skill)-[rt:RELATED_TO]->(s2:Skill)
                RETURN f, hs, s, wo, p, ref, referrer, rt, s1, s2
                LIMIT $limit
                """,
                limit=limit,
            )
            records = await result.data()

        nodes: dict[str, GraphNode] = {}
        links: list[GraphLink] = []
        seen_links: set[tuple[str, str, str]] = set()

        def add_node(node_id: str, name: str, node_type: str) -> None:
            if node_id not in nodes:
                nodes[node_id] = GraphNode(
                    id=node_id,
                    name=name,
                    type=node_type,  # type: ignore[arg-type]
                )

        def add_link(source: str, target: str, rel_type: str) -> None:
            key = (source, target, rel_type)
            if key not in seen_links:
                seen_links.add(key)
                links.append(GraphLink(source=source, target=target, type=rel_type))

        for row in records:
            f = row.get("f")
            if f:
                fid = f.get("id")
                fname = f.get("name", f"Freelancer {fid}")
                add_node(f"f-{fid}", fname, "freelancer")

            s = row.get("s")
            if s and f:
                sname = s.get("name")
                add_node(f"s-{sname}", sname, "skill")
                add_link(f"f-{f.get('id')}", f"s-{sname}", "HAS_SKILL")

            p = row.get("p")
            if p and f:
                pid = p.get("id")
                ptitle = p.get("title", f"Project {pid}")
                add_node(f"p-{pid}", ptitle, "project")
                add_link(f"f-{f.get('id')}", f"p-{pid}", "WORKED_ON")

            referrer = row.get("referrer")
            if referrer and f:
                rid = referrer.get("id")
                add_node(f"f-{rid}", referrer.get("name", f"Freelancer {rid}"), "freelancer")
                add_link(f"f-{f.get('id')}", f"f-{rid}", "REFERRED_BY")

            s1, s2 = row.get("s1"), row.get("s2")
            if s1 and s2:
                a, b = s1.get("name"), s2.get("name")
                add_node(f"s-{a}", a, "skill")
                add_node(f"s-{b}", b, "skill")
                add_link(f"s-{a}", f"s-{b}", "RELATED_TO")

        return GraphResponse(
            nodes=list(nodes.values()),
            links=links,
            source="neo4j",
        )

    async def clear_graph(self) -> None:
        driver = get_neo4j_driver()
        async with driver.session() as session:
            await session.run("MATCH (n) DETACH DELETE n")

    @staticmethod
    def merge_postgres_graph(
        pg_freelancers: list[tuple[int, str, list[str], float]],
        pg_skill_rels: list[tuple[str, str]],
        neo4j_skill_edges: list[dict[str, Any]],
    ) -> GraphResponse:
        """Build force-directed graph from PostgreSQL rows enriched with Neo4j skill edges."""
        nodes: list[GraphNode] = []
        links: list[GraphLink] = []
        skill_nodes: set[str] = set()
        seen_links: set[tuple[str, str, str]] = set()

        for fid, name, skills, fraud_score in pg_freelancers:
            nodes.append(
                GraphNode(
                    id=f"f-{fid}",
                    name=name,
                    type="freelancer",
                    fraud_score=fraud_score,
                )
            )
            for skill in skills:
                skill_nodes.add(skill)
                links.append(
                    GraphLink(source=f"f-{fid}", target=f"s-{skill}", type="HAS_SKILL")
                )

        for skill in skill_nodes:
            nodes.append(GraphNode(id=f"s-{skill}", name=skill, type="skill"))

        for skill_a, skill_b in pg_skill_rels:
            if skill_a in skill_nodes and skill_b in skill_nodes:
                key = (f"s-{skill_a}", f"s-{skill_b}", "RELATED_TO")
                if key not in seen_links:
                    seen_links.add(key)
                    links.append(GraphLink(source=key[0], target=key[1], type="RELATED_TO"))

        source = "postgres"
        for edge in neo4j_skill_edges:
            sa, sb = edge["source"], edge["target"]
            if sa not in skill_nodes:
                skill_nodes.add(sa)
                nodes.append(GraphNode(id=f"s-{sa}", name=sa, type="skill"))
            if sb not in skill_nodes:
                skill_nodes.add(sb)
                nodes.append(GraphNode(id=f"s-{sb}", name=sb, type="skill"))
            key = (f"s-{sa}", f"s-{sb}", edge.get("rel_type", "RELATED_TO"))
            if key not in seen_links:
                seen_links.add(key)
                links.append(GraphLink(source=key[0], target=key[1], type=key[2]))
            source = "postgres+neo4j"

        return GraphResponse(nodes=nodes, links=links, source=source)
