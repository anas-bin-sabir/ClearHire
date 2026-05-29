from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self._session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        name: str,
        email: str,
        role: str,
    ) -> User:
        stmt = (
            insert(User)
            .values(name=name, email=email, role=role)
            .on_conflict_do_update(
                index_elements=["email"],
                set_={"name": name, "role": role},
            )
            .returning(User)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()
