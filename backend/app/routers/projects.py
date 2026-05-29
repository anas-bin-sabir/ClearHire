from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_contract_repo, get_project_repo
from app.db.repositories.postgres import ContractRepository, ProjectRepository
from app.db.utils.serializers import project_to_dict
from app.models.orm import ContractStatus
from app.models.schemas import ProjectListResponse, ProjectRecord

router = APIRouter()


def resolve_project_status(contracts) -> str:
    if not contracts:
        return "open"
    statuses = {c.status for c in contracts}
    if statuses <= {ContractStatus.COMPLETED.value}:
        return "completed"
    if ContractStatus.ACTIVE.value in statuses:
        return "in_progress"
    if ContractStatus.CANCELLED.value in statuses and len(statuses) == 1:
        return "completed"
    return "open"


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectListResponse:
    rows = await project_repo.list_all(limit=200)
    projects: list[ProjectRecord] = []
    for project in rows:
        contracts = await contract_repo.list_by_project(project.id)
        base = project_to_dict(project)
        created = project.created_at.isoformat()[:10] if project.created_at else None
        budget = float(project.budget or 0)
        priority = (
            "high"
            if budget >= 15000
            else "medium"
            if budget >= 8000
            else "low"
        )
        projects.append(
            ProjectRecord(
                id=project.id,
                title=base.get("title") or f"Project {project.id}",
                description=base.get("description") or "",
                required_skills=base.get("required_skills") or [],
                budget=budget,
                deadline_days=project.deadline_days,
                team_size=project.team_size,
                status=resolve_project_status(contracts),
                team_members=[c.freelancer_id for c in contracts],
                client=f"Client #{project.client_id}" if project.client_id else "ClearHire",
                created=created,
                priority=priority,
            )
        )
    return ProjectListResponse(projects=projects, total=len(projects))


@router.get("/{project_id}", response_model=ProjectRecord)
async def get_project(
    project_id: int,
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectRecord:
    project = await project_repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    contracts = await contract_repo.list_by_project(project.id)
    base = project_to_dict(project)
    return ProjectRecord(
        id=project.id,
        title=base.get("title") or f"Project {project.id}",
        description=base.get("description") or "",
        required_skills=base.get("required_skills") or [],
        budget=float(project.budget or 0),
        deadline_days=project.deadline_days,
        team_size=project.team_size,
        status=resolve_project_status(contracts),
        team_members=[c.freelancer_id for c in contracts],
        client=f"Client #{project.client_id}" if project.client_id else "ClearHire",
        created=project.created_at.isoformat()[:10] if project.created_at else None,
        priority="medium",
    )
