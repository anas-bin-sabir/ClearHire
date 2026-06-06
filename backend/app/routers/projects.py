from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_contract_repo, get_project_repo
from app.core.events import ClearHireEvent, emit
from app.db.repositories.postgres import ContractRepository, ProjectRepository
from app.db.utils.serializers import project_to_dict
from app.models.orm import ContractStatus
from app.models.schemas import (
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectListResponse,
    ProjectRecord,
)

router = APIRouter()


def resolve_project_status(contracts: list) -> str:
    if not contracts:
        return "open"
    statuses = {c.status for c in contracts}
    if ContractStatus.ACTIVE.value in statuses:
        return "in_progress"
    if statuses == {ContractStatus.COMPLETED.value}:
        return "completed"
    if ContractStatus.PENDING.value in statuses:
        return "open"
    return "open"


def _build_description(body: ProjectCreateRequest) -> str | None:
    desc = (body.description or "").strip()
    if body.client:
        prefix = f"Client: {body.client.strip()}"
        return f"{prefix}\n\n{desc}" if desc else prefix
    return desc or None


def _extract_client(description: str | None) -> str | None:
    if not description:
        return None
    first = description.split("\n", 1)[0].strip()
    if first.lower().startswith("client:"):
        return first.split(":", 1)[1].strip() or None
    return None


def _record_from_project(project, contracts: list) -> ProjectRecord:
    base = project_to_dict(project)
    team_members = [c.freelancer_id for c in contracts]
    return ProjectRecord(
        id=base["id"],
        title=base.get("title") or "Untitled",
        description=base.get("description") or "",
        required_skills=base.get("required_skills") or [],
        budget=base.get("budget") or 0,
        deadline_days=base.get("deadline_days") or 30,
        team_size=base.get("team_size") or 1,
        status=resolve_project_status(contracts),
        team_members=team_members,
        client=_extract_client(base.get("description")),
        created=base.get("created_at"),
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectListResponse:
    projects = await project_repo.list_all(limit=100)
    project_ids = [p.id for p in projects]
    contracts_by_project = await contract_repo.list_by_project_ids(project_ids)

    records: list[ProjectRecord] = []
    for project in projects:
        contracts = contracts_by_project.get(project.id, [])
        records.append(_record_from_project(project, contracts))

    return ProjectListResponse(projects=records, total=len(records))


@router.post("", response_model=ProjectCreateResponse, status_code=201)
async def create_project(
    body: ProjectCreateRequest,
    project_repo: ProjectRepository = Depends(get_project_repo),
) -> ProjectCreateResponse:
    project = await project_repo.create(
        title=body.title.strip(),
        description=_build_description(body),
        required_skills=body.required_skills,
        budget=body.budget,
        deadline_days=body.deadline_days,
        team_size=body.team_size,
    )
    record = _record_from_project(project, [])

    await emit(ClearHireEvent.PROJECT_CREATED, {
        "project_id": project.id,
        "title": project.title or "",
        "description": project.description or "",
        "required_skills": list(project.required_skills or []),
        "budget": float(project.budget or 0),
        "deadline_days": int(project.deadline_days or 30),
        "team_size": int(project.team_size or 1),
    })

    return ProjectCreateResponse(project=record)


@router.get("/{project_id}", response_model=ProjectRecord)
async def get_project(
    project_id: int,
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectRecord:
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    contracts = await contract_repo.list_by_project(project_id)
    return _record_from_project(project, contracts)
