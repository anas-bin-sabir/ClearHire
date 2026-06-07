import random
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.neo4j import GraphRepository
from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
    SkillRelationshipRepository,
    UserRepository,
)
from app.db.repositories.mongo import FreelancerMetaRepository
from app.db.utils.embeddings import random_unit_embedding
from app.models.orm import ContractStatus
from app.core.security import get_password_hash

SKILLS_LIST = [
    "Python",
    "JavaScript",
    "React",
    "FastAPI",
    "ML",
    "Data Science",
    "DevOps",
    "Docker",
    "PostgreSQL",
    "UI/UX",
    "Figma",
    "Node.js",
]
LOCATIONS = ["San Francisco", "Berlin", "London", "Remote", "Tokyo", "Singapore"]
PG_SKILL_RELATIONSHIPS = [
    ("Python", "FastAPI"),
    ("React", "JavaScript"),
    ("ML", "Python"),
    ("DevOps", "Docker"),
    ("PostgreSQL", "Node.js"),
]


@dataclass
class SeedResult:
    freelancers_created: int
    projects_created: int
    contracts_created: int
    neo4j_synced: bool


class DatabaseSeeder:
    """Orchestrates PostgreSQL, MongoDB meta, and Neo4j graph seeding."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        graph_repo: GraphRepository | None = None,
        meta_repo: FreelancerMetaRepository | None = None,
    ) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._freelancers = FreelancerRepository(session)
        self._projects = ProjectRepository(session)
        self._contracts = ContractRepository(session)
        self._skills = SkillRelationshipRepository(session)
        self._graph = graph_repo or GraphRepository()
        self._meta = meta_repo or FreelancerMetaRepository()

    async def run(
        self,
        *,
        freelancer_count: int = 50,
        reset: bool = False,
        sync_neo4j: bool = True,
    ) -> SeedResult:
        if reset:
            await self._contracts.delete_all()
            await self._freelancers.delete_all()
            await self._projects.delete_all()
            await self._skills.delete_all()
            if sync_neo4j:
                try:
                    await self._graph.clear_graph()
                except Exception:
                    pass

        demo_pwd_hash = get_password_hash("demo")

        admin = await self._users.upsert(
            name="Admin System",
            email="admin@clearhire.ai",
            role="admin",
            password_hash=demo_pwd_hash,
        )

        # Seed additional demo accounts
        await self._users.upsert(
            name="Admin",
            email="admin@demo.com",
            role="admin",
            password_hash=demo_pwd_hash,
        )

        await self._users.upsert(
            name="Sara Ahmed",
            email="client@demo.com",
            role="client",
            password_hash=demo_pwd_hash,
        )

        created_freelancers: list = []
        referrer_id: int | None = None

        for i in range(freelancer_count):
            skills = list(
                {random.choice(SKILLS_LIST) for _ in range(3 + random.randint(0, 3))}
            )
            is_suspicious = i < 5
            if i == 0:
                name = "Ali Raza"
                email = "freelancer@demo.com"
            else:
                name = f"Freelancer {i + 1}"
                email = f"freelancer{i + 1}@example.com"

            user = await self._users.upsert(
                name=name,
                email=email,
                role="freelancer",
                password_hash=demo_pwd_hash,
            )

            referred_by = referrer_id if i > 0 and i % 7 == 0 else None
            freelancer = await self._freelancers.create(
                user_id=user.id,
                name=name,
                skills=skills,
                rating=round(3 + random.random() * 2, 2),
                hourly_rate=180.0 if is_suspicious else float(30 + random.randint(0, 120)),
                experience_years=1 if is_suspicious else 2 + random.randint(0, 15),
                account_age_days=15 if is_suspicious else 60 + random.randint(0, 1000),
                fraud_score=0.85 if is_suspicious else round(random.random() * 0.2, 3),
                bio=f"Professional expert in {', '.join(skills)}.",
                location=random.choice(LOCATIONS),
                availability=True,
                review_count=random.randint(0, 80),
                portfolio_urls=[]
                if not is_suspicious
                else ["https://example.com/portfolio"],
                embedding=random_unit_embedding(),
                referred_by_id=referred_by,
            )
            created_freelancers.append(freelancer)
            if i == 0:
                referrer_id = freelancer.id

            await self._meta.upsert(
                freelancer_id=freelancer.id,
                tags=skills[:2],
                social_links={"linkedin": f"https://linkedin.com/in/fl-{freelancer.id}"},
                verification={"email": True, "id": not is_suspicious},
            )

        project = await self._projects.create(
            client_id=admin.id,
            title="AI Platform Development",
            description="Looking for a robust team to build a next-gen AI hiring tool.",
            required_skills=["Python", "React", "ML"],
            budget=15000.0,
            deadline_days=45,
            team_size=3,
            embedding=random_unit_embedding(),
        )

        contracts_created = 0
        for fl in created_freelancers[:3]:
            await self._contracts.upsert(
                freelancer_id=fl.id,
                project_id=project.id,
                status=ContractStatus.ACTIVE.value,
            )
            contracts_created += 1

        for skill_a, skill_b in PG_SKILL_RELATIONSHIPS:
            await self._skills.upsert_pair(skill_a, skill_b)

        neo4j_synced = False
        if sync_neo4j:
            try:
                await self._graph.ensure_constraints()
                await self._graph.seed_skill_ontology()
                for fl in created_freelancers:
                    await self._graph.merge_freelancer(
                        freelancer_id=fl.id,
                        name=fl.name,
                        skills=list(fl.skills or []),
                        referred_by_id=fl.referred_by_id,
                    )
                await self._graph.merge_project(
                    project_id=project.id,
                    title=project.title or "Untitled",
                    required_skills=list(project.required_skills or []),
                )
                for fl in created_freelancers[:3]:
                    await self._graph.link_worked_on(
                        freelancer_id=fl.id,
                        project_id=project.id,
                        status=ContractStatus.ACTIVE.value,
                    )
                neo4j_synced = True
            except Exception:
                neo4j_synced = False

        return SeedResult(
            freelancers_created=len(created_freelancers),
            projects_created=1,
            contracts_created=contracts_created,
            neo4j_synced=neo4j_synced,
        )
