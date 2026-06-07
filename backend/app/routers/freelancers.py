from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_freelancer_repo
from app.core.events import ClearHireEvent, emit
from app.db.repositories.postgres import FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import FreelancerCreateRequest, FreelancerCreateResponse, FreelancerListResponse, FreelancerRecord, SkillListResponse, FreelancerUpdateRequest  

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


@router.get("/skills/list", response_model=SkillListResponse)
async def list_skills(
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> SkillListResponse:
    skills = await freelancer_repo.list_distinct_skills()
    return SkillListResponse(skills=skills)


@router.post("", response_model=FreelancerCreateResponse, status_code=201)
async def create_freelancer(
    body: FreelancerCreateRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerCreateResponse:
    """
    Create a freelancer. Fraud analysis runs automatically in the background.
    Response returns immediately — fraud_score updates within 2–15 seconds.
    """
    freelancer = await freelancer_repo.create(
        name=body.name,
        skills=body.skills,
        hourly_rate=body.hourly_rate,
        experience_years=body.experience_years,
        rating=body.rating if body.rating is not None else 0.0,
        review_count=body.review_count if body.review_count is not None else 0,
        account_age_days=body.account_age_days if body.account_age_days is not None else 0,
        availability=body.availability if body.availability is not None else True,
        fraud_score=0.0,
    )

    await emit(ClearHireEvent.FREELANCER_CREATED, {
        "freelancer_id": freelancer.id,
        "name": freelancer.name,
        "skills": list(freelancer.skills or []),
        "hourly_rate": float(freelancer.hourly_rate or 0),
        "experience_years": int(freelancer.experience_years or 0),
        "rating": float(freelancer.rating or 0),
        "review_count": int(freelancer.review_count or 0),
        "account_age_days": int(freelancer.account_age_days or 0),
        "portfolio_urls": list(getattr(freelancer, "portfolio_urls", None) or []),
    })

    return FreelancerCreateResponse(
        freelancer=freelancer_to_dict(freelancer),
        message="Freelancer created. Fraud analysis running in background.",
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


@router.patch("/{freelancer_id}", response_model=FreelancerRecord)
async def update_freelancer(
    freelancer_id: int,
    body: FreelancerUpdateRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerRecord:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    updated = await freelancer_repo.update(freelancer_id, body.model_dump(exclude_none=True))
    await emit(ClearHireEvent.FREELANCER_CREATED, {   # reuse existing event — re-runs fraud agent
        "freelancer_id": updated.id,
        "name": updated.name,
        "skills": list(updated.skills or []),
        "hourly_rate": float(updated.hourly_rate or 0),
        "experience_years": int(updated.experience_years or 0),
        "rating": float(updated.rating or 0),
        "review_count": int(updated.review_count or 0),
        "account_age_days": int(updated.account_age_days or 0),
        "portfolio_urls": list(getattr(updated, "portfolio_urls", None) or []),
    })
    return FreelancerRecord.model_validate(freelancer_to_dict(updated))

class FlagUpdateRequest(BaseModel):
    is_flagged: bool
    reason: Optional[str] = None

@router.patch("/{freelancer_id}/flag", response_model=FreelancerRecord)
async def flag_freelancer(
    freelancer_id: int,
    body: FlagUpdateRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerRecord:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    # Force score above/below threshold based on admin decision
    new_score = 0.9 if body.is_flagged else 0.2
    updated = await freelancer_repo.update(freelancer_id, {"fraud_score": new_score})
    return FreelancerRecord.model_validate(freelancer_to_dict(updated))