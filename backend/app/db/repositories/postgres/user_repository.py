import uuid

from sqlalchemy import select, update
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
        normalized = email.strip().lower()
        result = await self._session.execute(select(User).where(User.email == normalized))
        return result.scalar_one_or_none()

    async def get_by_auth_id(self, auth_user_id: str | uuid.UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(User.auth_user_id == uuid.UUID(str(auth_user_id)))
        )
        return result.scalar_one_or_none()

    async def link_auth_id(self, user_id: int, auth_user_id: str | uuid.UUID) -> None:
        """Attach a Supabase Auth account. The local hash is dropped: Supabase owns
        the password from now on."""
        await self._session.execute(
            update(User)
            .where(User.id == user_id)
            .values(auth_user_id=uuid.UUID(str(auth_user_id)), password_hash=None)
        )

    async def create(
        self,
        *,
        name: str,
        email: str,
        role: str,
        password_hash: str | None = None,
        auth_user_id: str | uuid.UUID | None = None,
    ) -> User:
        user = User(
            name=name,
            email=email.strip().lower(),
            role=role,
            password_hash=password_hash,
            auth_user_id=uuid.UUID(str(auth_user_id)) if auth_user_id else None,
        )
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
