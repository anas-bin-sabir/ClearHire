from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_freelancer_repo
from app.db.repositories.postgres import FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import FreelancerListResponse, FreelancerRecord

router = APIRouter()


@router.get("", response_model=FreelancerListResponse)
async def list_freelancers(
    q: str | None = Query(default=None, description="Name or numeric ID"),
    limit: int = Query(default=50, ge=1, le=200),
    flagged_only: bool = Query(default=False),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerListResponse:
    rows = await freelancer_repo.search(q=q, limit=limit, flagged_only=flagged_only)
    return FreelancerListResponse(
        freelancers=[freelancer_to_dict(f) for f in rows],
        total=len(rows),
    )


@router.get("/{freelancer_id}", response_model=FreelancerRecord)
async def get_freelancer(
    freelancer_id: int,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerRecord:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    return FreelancerRecord.model_validate(freelancer_to_dict(freelancer))
