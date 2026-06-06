from fastapi import APIRouter, Depends

from app.core.dependencies import (
    get_activity_repo,
    get_contract_repo,
    get_freelancer_repo,
    get_project_repo,
)
from app.db.repositories.mongo import ActivityLogRepository
from app.db.repositories.postgres import (
    ContractRepository,
    FreelancerRepository,
    ProjectRepository,
)
from app.models.schemas import PlatformStatsResponse
from app.routers.projects import resolve_project_status

router = APIRouter()


@router.get("", response_model=PlatformStatsResponse)
async def platform_stats(
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
    activity_repo: ActivityLogRepository = Depends(get_activity_repo),
) -> PlatformStatsResponse:
    freelancers_total = await freelancer_repo.count_all()
    fraud_flagged = await freelancer_repo.count_flagged(threshold=0.6)
    projects = await project_repo.list_all(limit=500)
    project_ids = [p.id for p in projects]
    contracts_by_project = await contract_repo.list_by_project_ids(project_ids)

    open_projects = 0
    for project in projects:
        contracts = contracts_by_project.get(project.id, [])
        if resolve_project_status(contracts) == "open":
            open_projects += 1

    teams_built = await activity_repo.count_successful(endpoint="/team-builder")

    return PlatformStatsResponse(
        freelancers_total=freelancers_total,
        open_projects=open_projects,
        fraud_flagged=fraud_flagged,
        teams_built=teams_built,
        projects_total=len(projects),
    )
