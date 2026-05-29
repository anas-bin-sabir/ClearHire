from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.mongo import (
    ActivityLogRepository,
    AIExplanationRepository,
    FreelancerMetaRepository,
    SearchHistoryRepository,
)
from app.db.repositories.neo4j import GraphRepository
from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
    SkillRelationshipRepository,
    UserRepository,
)
from app.db.session import async_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_user_repo(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    return UserRepository(session)


def get_freelancer_repo(
    session: AsyncSession = Depends(get_db_session),
) -> FreelancerRepository:
    return FreelancerRepository(session)


def get_project_repo(session: AsyncSession = Depends(get_db_session)) -> ProjectRepository:
    return ProjectRepository(session)


def get_contract_repo(session: AsyncSession = Depends(get_db_session)) -> ContractRepository:
    return ContractRepository(session)


def get_skill_repo(
    session: AsyncSession = Depends(get_db_session),
) -> SkillRelationshipRepository:
    return SkillRelationshipRepository(session)


def get_activity_repo() -> ActivityLogRepository:
    return ActivityLogRepository()


def get_search_history_repo() -> SearchHistoryRepository:
    return SearchHistoryRepository()


def get_ai_explanation_repo() -> AIExplanationRepository:
    return AIExplanationRepository()


def get_freelancer_meta_repo() -> FreelancerMetaRepository:
    return FreelancerMetaRepository()


def get_graph_repo() -> GraphRepository:
    return GraphRepository()
