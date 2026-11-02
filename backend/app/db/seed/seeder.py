import random
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
    SkillRelationshipRepository,
    SkillRepository,
    UserRepository,
)
from app.ai.fraud import score_fraud
from app.ai.types import FreelancerCandidate
from app.core.security import get_password_hash
from app.db.utils.serializers import freelancer_to_dict
from app.models.orm import ContractStatus

SKILLS_LIST = [
    "Python",
    "JavaScript",
    "React",
    "FastAPI",
    "Machine Learning",
    "Data Science",
    "DevOps",
    "Docker",
    "PostgreSQL",
    "UI/UX Design",
    "Figma",
    "Node.js",
]
PAKISTANI_FIRST_NAMES = [
    "Muhammad", "Ahmad", "Ali", "Hamza", "Usman", "Bilal", "Zubair", "Saad", "Haris", "Fawad",
    "Tariq", "Waseem", "Babar", "Shaheen", "Asif", "Shadab", "Yasir", "Hassan", "Farhan", "Faisal",
    "Muneeb", "Asim", "Sheheryar", "Ayesha", "Zainab", "Fatima", "Sana", "Mariam", "Amna", "Hira",
    "Nida", "Kiran", "Saba", "Mahira", "Sajal", "Amina", "Fiza", "Urwa", "Mawra", "Mehwish",
    "Aiman", "Sanam", "Hania", "Maya", "Zara", "Iqra", "Zoya", "Alishba", "Laiba", "Eshal"
]
PAKISTANI_LAST_NAMES = [
    "Khan", "Ali", "Ahmed", "Raza", "Shah", "Sheikh", "Bibi", "Zahra", "Minhas", "Nawaz",
    "Rafique", "Mani", "Rauf", "Dar", "Alam", "Jameel", "Qamar", "Akram", "Azam", "Afridi",
    "Bhutto", "Saeed", "Hocane", "Hayat", "Qureshi", "Butt", "Baloch", "Amir", "Azhar", "Munawar",
    "Abbas", "Aziz", "Hussain", "Malik", "Iqbal", "Chaudhry", "Gill", "Lodhi", "Siddiqui", "Hashmi",
    "Mughal", "Farooq", "Zaman", "Baig", "Latif", "Javed", "Rasheed", "Rehman", "Abid", "Wahid"
]
LOCATIONS = ["Karachi", "Lahore", "Islamabad", "Peshawar", "Faisalabad", "Multan", "Rawalpindi", "Remote"]

# Meets the signup rule (8+ chars, a letter and a digit) and Supabase Auth's minimum,
# so seeded accounts can move to Supabase on first login.
DEMO_PASSWORD = "demo1234"


@dataclass
class SeedResult:
    freelancers_created: int
    projects_created: int
    contracts_created: int


class DatabaseSeeder:
    """Seeds the single PostgreSQL database."""

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._freelancers = FreelancerRepository(session)
        self._projects = ProjectRepository(session)
        self._contracts = ContractRepository(session)
        self._skills = SkillRelationshipRepository(session)
        self._taxonomy = SkillRepository(session)

    async def run(
        self,
        *,
        freelancer_count: int = 50,
        reset: bool = False,
    ) -> SeedResult:
        if reset:
            await self._contracts.delete_all()
            await self._freelancers.delete_all()
            await self._projects.delete_all()
            await self._skills.delete_all()

        # Also restores the curated skill adjacency deleted above.
        await self._taxonomy.sync_taxonomy()
        demo_pwd_hash = get_password_hash(DEMO_PASSWORD)

        await self._users.upsert(
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

        client = await self._users.upsert(
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
            is_suspicious = 1 <= i <= 5
            if i == 0:
                name = "Ali Raza"
                email = "freelancer@demo.com"
            else:
                first_name = PAKISTANI_FIRST_NAMES[i % len(PAKISTANI_FIRST_NAMES)]
                last_name = PAKISTANI_LAST_NAMES[(i * 3) % len(PAKISTANI_LAST_NAMES)]
                name = f"{first_name} {last_name}"
                email = f"{first_name.lower()}.{last_name.lower()}{i}@example.com"

            user = await self._users.upsert(
                name=name,
                email=email,
                role="freelancer",
                password_hash=demo_pwd_hash,
            )

            referred_by = referrer_id if i > 0 and i % 7 == 0 else None
            # Suspicious profiles get the traits the fraud model looks for (young
            # account, inflated rate, perfect review burst); the score itself is
            # computed by the model below, not hardcoded.
            freelancer = await self._freelancers.create(
                user_id=user.id,
                name=name,
                skills=skills,
                rating=4.97 if is_suspicious else round(3 + random.random() * 2, 2),
                hourly_rate=180.0 if is_suspicious else float(30 + random.randint(0, 120)),
                experience_years=1 if is_suspicious else 2 + random.randint(0, 15),
                account_age_days=15 if is_suspicious else 60 + random.randint(0, 1000),
                fraud_score=0.0,
                bio=f"Professional expert in {', '.join(skills)}.",
                location=random.choice(LOCATIONS),
                availability=True,
                review_count=60 if is_suspicious else random.randint(0, 50),
                portfolio_urls=["https://example.com/portfolio"] if is_suspicious else [],
                referred_by_id=referred_by,
            )
            assessment = score_fraud(
                FreelancerCandidate.from_dict(freelancer_to_dict(freelancer))
            )
            freelancer.fraud_score = assessment.score
            created_freelancers.append(freelancer)
            if i == 0:
                referrer_id = freelancer.id

        project = await self._projects.create(
            client_id=client.id,
            title="AI Platform Development",
            description="Looking for a robust team to build a next-gen AI hiring tool.",
            required_skills=["Python", "React", "Machine Learning"],
            budget=15000.0,
            deadline_days=45,
            team_size=3,
        )

        contracts_created = 0
        for fl in created_freelancers[:3]:
            await self._contracts.create(
                freelancer_id=fl.id,
                project_id=project.id,
                status=ContractStatus.ACTIVE.value,
            )
            contracts_created += 1

        return SeedResult(
            freelancers_created=len(created_freelancers),
            projects_created=1,
            contracts_created=contracts_created,
        )

    async def rebuild_graph(self) -> bool:
        """Commit, then rebuild the Neo4j read model when enabled (best-effort).

        Seeding uses bulk statements the outbox listener can't see, so a full
        rebuild is the reliable way to bring the graph in line. Returns True when a
        rebuild ran; never raises for Neo4j errors.
        """
        from app.graph.sync import rebuild_if_enabled

        await self._session.commit()
        return await rebuild_if_enabled(self._session) is not None
