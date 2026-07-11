from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Contract, ContractStatus

VALID_TRANSITIONS = {
    ContractStatus.PENDING.value: {
        ContractStatus.ACTIVE.value,
        ContractStatus.CANCELLED.value,
    },
    ContractStatus.ACTIVE.value: {
        ContractStatus.COMPLETED.value,
        ContractStatus.CANCELLED.value,
    },
    ContractStatus.COMPLETED.value: set(),
    ContractStatus.CANCELLED.value: set(),
}





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

    async def list_by_project_ids(self, project_ids: list[int]) -> dict[int, list[Contract]]:
        """Batch fetch contracts for multiple projects — avoids N+1 queries."""
        if not project_ids:
            return {}
        result = await self._session.execute(
            select(Contract).where(Contract.project_id.in_(project_ids))
        )
        contracts = list(result.scalars().all())
        grouped: dict[int, list[Contract]] = {pid: [] for pid in project_ids}
        for c in contracts:
            grouped[c.project_id].append(c)
        return grouped

    async def list_by_freelancer(self, freelancer_id: int) -> list[Contract]:
        result = await self._session.execute(
            select(Contract).where(Contract.freelancer_id == freelancer_id)
        )
        return list(result.scalars().all())

    async def get_pair(self, freelancer_id: int, project_id: int) -> Contract | None:
        result = await self._session.execute(
            select(Contract).where(
                Contract.freelancer_id == freelancer_id,
                Contract.project_id == project_id,
            )
        )
        return result.scalar_one_or_none()

    def can_transition(self, current: str, target: str) -> bool:
        if current == target:
            return True
        return target in VALID_TRANSITIONS.get(current, set())

    async def create(self, **fields: Any) -> Contract:
        contract = Contract(**fields)
        self._session.add(contract)
        await self._session.flush()
        await self._session.refresh(contract)
        return contract

    async def update_status(self, contract_id: int, status: str) -> Contract:
        contract = await self.get_by_id(contract_id)
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")
        contract.status = status
        await self._session.flush()
        await self._session.refresh(contract)
        return contract

    async def list_all(self, limit: int = 200) -> list[Contract]:
        result = await self._session.execute(
            select(Contract).order_by(Contract.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def delete_all(self) -> None:
        await self._session.execute(delete(Contract))
