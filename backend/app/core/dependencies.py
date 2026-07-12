from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.repositories.postgres import (
    ActivityLogRepository,
    AIExplanationRepository,
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
    SearchHistoryRepository,
    SkillRelationshipRepository,
    SkillRepository,
    UserRepository,
    UserSettingsRepository,
)
from app.db.session import async_session_factory
from app.models.orm import User

bearer_scheme = HTTPBearer(auto_error=False)


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


def get_skill_taxonomy_repo(
    session: AsyncSession = Depends(get_db_session),
) -> SkillRepository:
    return SkillRepository(session)


def get_user_settings_repo(
    session: AsyncSession = Depends(get_db_session),
) -> UserSettingsRepository:
    return UserSettingsRepository(session)


def get_activity_repo(
    session: AsyncSession = Depends(get_db_session),
) -> ActivityLogRepository:
    return ActivityLogRepository(session)


def get_search_history_repo(
    session: AsyncSession = Depends(get_db_session),
) -> SearchHistoryRepository:
    return SearchHistoryRepository(session)


def get_ai_explanation_repo(
    session: AsyncSession = Depends(get_db_session),
) -> AIExplanationRepository:
    return AIExplanationRepository(session)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user = await user_repo.get_by_id(int(payload["user_id"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User | None:
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, user_repo)
    except HTTPException:
        return None


def require_role(*roles: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _checker


async def require_client(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("client", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role required",
        )
    return user


async def require_freelancer(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("freelancer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Freelancer role required",
        )
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


def owns_project(user: User, project) -> bool:
    """Clients may manage only their own projects; admins may manage any."""
    return user.role == "admin" or (
        project.client_id is not None and project.client_id == user.id
    )
