from fastapi import APIRouter, Depends, HTTPException

from app.core.activity import log_activity
from app.core.dependencies import get_contract_repo, get_freelancer_repo, get_project_repo
from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
)
from app.db.utils.serializers import contract_to_dict
from app.models.schemas import (
    ContractBatchRequest,
    ContractCreateRequest,
    ContractListResponse,
    ContractRecord,
    ContractUpdateRequest,
)

router = APIRouter()


def _to_record(contract) -> ContractRecord:
    data = contract_to_dict(contract)
    return ContractRecord(
        id=data["id"],
        freelancer_id=data["freelancer_id"],
        project_id=data["project_id"],
        status=data["status"],
        created_at=data.get("created_at"),
    )


@router.get("/freelancer/{freelancer_id}", response_model=ContractListResponse)
async def list_contracts_by_freelancer(
    freelancer_id: int,
    contract_repo: ContractRepository = Depends(get_contract_repo),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> ContractListResponse:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    contracts = await contract_repo.list_by_freelancer(freelancer_id)
    records = [_to_record(c) for c in contracts]
    return ContractListResponse(contracts=records, total=len(records))


@router.get("/project/{project_id}", response_model=ContractListResponse)
async def list_contracts_by_project(
    project_id: int,
    contract_repo: ContractRepository = Depends(get_contract_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
) -> ContractListResponse:
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    contracts = await contract_repo.list_by_project(project_id)
    records = [_to_record(c) for c in contracts]
    return ContractListResponse(contracts=records, total=len(records))


@router.post("", response_model=ContractRecord, status_code=201)
async def create_contract(
    body: ContractCreateRequest,
    contract_repo: ContractRepository = Depends(get_contract_repo),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
) -> ContractRecord:
    freelancer = await freelancer_repo.get_by_id(body.freelancer_id)
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    project = await project_repo.get_by_id(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract = await contract_repo.upsert(
        freelancer_id=body.freelancer_id,
        project_id=body.project_id,
        status=body.status,
    )
    return _to_record(contract)


@router.post("/batch", response_model=ContractListResponse, status_code=201)
async def create_contracts_batch(
    body: ContractBatchRequest,
    contract_repo: ContractRepository = Depends(get_contract_repo),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
) -> ContractListResponse:
    project = await project_repo.get_by_id(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    records: list[ContractRecord] = []
    for freelancer_id in body.freelancer_ids:
        freelancer = await freelancer_repo.get_by_id(freelancer_id)
        if not freelancer:
            continue
        contract = await contract_repo.upsert(
            freelancer_id=freelancer_id,
            project_id=body.project_id,
            status=body.status,
        )
        records.append(_to_record(contract))

    await log_activity(
        endpoint="/contracts/batch",
        method="POST",
        payload=body.model_dump(),
        response_summary={
            "project_id": body.project_id,
            "assigned": len(records),
        },
    )

    return ContractListResponse(contracts=records, total=len(records))


@router.patch("/{contract_id}", response_model=ContractRecord)
async def update_contract_status(
    contract_id: int,
    body: ContractUpdateRequest,
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ContractRecord:
    contract = await contract_repo.get_by_id(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    updated = await contract_repo.update_status(contract_id, body.status)
    return _to_record(updated)
