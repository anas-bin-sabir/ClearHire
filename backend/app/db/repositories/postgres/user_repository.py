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

    async def create(
        self,
        *,
        name: str,
        email: str,
        role: str,
        password_hash: str | None = None,
    ) -> User:
        user = User(name=name, email=email, role=role, password_hash=password_hash)
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return user

    async def upsert(
        self,
        *,
        name: str,
        email: str,
        role: str,
        password_hash: str | None = None,
    ) -> User:
        values = {"name": name, "email": email, "role": role}
        if password_hash is not None:
            values["password_hash"] = password_hash

        set_dict = {"name": name, "role": role}
        if password_hash is not None:
            set_dict["password_hash"] = password_hash

        stmt = (
            insert(User)
            .values(**values)
            .on_conflict_do_update(
                index_elements=["email"],
                set_=set_dict,
            )
            .returning(User)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()
