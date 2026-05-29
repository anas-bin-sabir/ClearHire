from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Contract, ContractStatus


class ContractRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, contract_id: int) -> Contract | None:
        result = await self._session.execute(
            select(Contract).where(Contract.id == contract_id)
        )
        return result.scalar_one_or_none()

    async def list_by_project(self, project_id: int) -> list[Contract]:
        result = await self._session.execute(
            select(Contract).where(Contract.project_id == project_id)
        )
        return list(result.scalars().all())

    async def list_by_freelancer(self, freelancer_id: int) -> list[Contract]:
        result = await self._session.execute(
            select(Contract).where(Contract.freelancer_id == freelancer_id)
        )
        return list(result.scalars().all())

    async def upsert(
        self,
        *,
        freelancer_id: int,
        project_id: int,
        status: str = ContractStatus.PENDING.value,
    ) -> Contract:
        stmt = (
            insert(Contract)
            .values(
                freelancer_id=freelancer_id,
                project_id=project_id,
                status=status,
            )
            .on_conflict_do_update(
                index_elements=["freelancer_id", "project_id"],
                set_={"status": status},
            )
            .returning(Contract)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def create(self, **fields: Any) -> Contract:
        contract = Contract(**fields)
        self._session.add(contract)
        await self._session.flush()
        await self._session.refresh(contract)
        return contract

    async def delete_all(self) -> None:
        await self._session.execute(delete(Contract))
