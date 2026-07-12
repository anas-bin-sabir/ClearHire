from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.ai.fraud import score_fraud
from app.ai.skill_taxonomy import CANONICAL_NAMES
from app.ai.types import FreelancerCandidate
from app.core.dependencies import get_current_user, get_freelancer_repo, require_admin, require_freelancer
from app.core.rate_limit import enforce_public_rate_limit
from app.db.repositories.postgres import FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.orm import User
from app.models.schemas import (
    FreelancerCreateRequest,
    FreelancerCreateResponse,
    FreelancerListResponse,
    FreelancerRecord,
    FreelancerUpdateRequest,
    SkillListResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=FreelancerListResponse,
    dependencies=[Depends(enforce_public_rate_limit)],
)
async def list_freelancers(
    q: str | None = Query(default=None, description="Name or numeric ID"),
    search: str | None = Query(default=None),
    skill: str | None = Query(default=None),
    rating: float | None = Query(default=None, ge=0, le=5),
    hourly_rate: float | None = Query(default=None, ge=0),
    availability: bool | None = Query(default=None),
    fraud_score: float | None = Query(default=None, ge=0, le=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    limit: int | None = Query(default=None, ge=1, le=200),
    flagged_only: bool = Query(default=False),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerListResponse:
    size = limit or page_size
    rows, total = await freelancer_repo.list_filtered(
        search=search or q,
        skill=skill,
        min_rating=rating,
        max_hourly_rate=hourly_rate,
        availability=availability,
        max_fraud_score=fraud_score,
        flagged_only=flagged_only,
        page=page,
        page_size=size,
    )
    return FreelancerListResponse(
        freelancers=[freelancer_to_dict(f) for f in rows],
        total=total,
    )


@router.get(
    "/skills/list",
    response_model=SkillListResponse,
    dependencies=[Depends(enforce_public_rate_limit)],
)
async def list_skills(
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> SkillListResponse:
    """Canonical taxonomy plus any custom skills freelancers already list."""
    custom = await freelancer_repo.list_distinct_skills()
    known = {name.lower() for name in CANONICAL_NAMES}
    extra = [s for s in custom if s.lower() not in known]
    return SkillListResponse(skills=sorted([*CANONICAL_NAMES, *extra], key=str.lower))


@router.post("", response_model=FreelancerCreateResponse, status_code=201)
async def create_freelancer(
    body: FreelancerCreateRequest,
    user: User = Depends(require_freelancer),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerCreateResponse:
    freelancer = await freelancer_repo.create(
        user_id=user.id if user.role == "freelancer" else None,
        name=body.name,
        skills=body.skills,
        hourly_rate=body.hourly_rate,
        experience_years=body.experience_years,
        rating=body.rating if body.rating is not None else 0.0,
        review_count=body.review_count if body.review_count is not None else 0,
        account_age_days=body.account_age_days if body.account_age_days is not None else 0,
        availability=body.availability if body.availability is not None else True,
        portfolio_urls=body.portfolio_urls or [],
        fraud_score=0.0,
    )
    assessment = score_fraud(FreelancerCandidate.from_dict(freelancer_to_dict(freelancer)))
    freelancer = await freelancer_repo.update(
        freelancer.id, {"fraud_score": assessment.score}
    )
    return FreelancerCreateResponse(
        freelancer=freelancer_to_dict(freelancer),
        message="Freelancer created.",
    )


@router.get(
    "/{freelancer_id}",
    response_model=FreelancerRecord,
    dependencies=[Depends(enforce_public_rate_limit)],
)
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
    user: User = Depends(get_current_user),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerRecord:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    if user.role != "admin" and freelancer.user_id not in (None, user.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    updated = await freelancer_repo.update(
        freelancer_id, body.model_dump(exclude_none=True)
    )
    return FreelancerRecord.model_validate(freelancer_to_dict(updated))


class FlagUpdateRequest(BaseModel):
    is_flagged: bool
    reason: Optional[str] = Field(default=None, max_length=1000)

    model_config = {"extra": "forbid"}


@router.patch("/{freelancer_id}/flag", response_model=FreelancerRecord)
async def flag_freelancer(
    freelancer_id: int,
    body: FlagUpdateRequest,
    _: User = Depends(require_admin),
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
) -> FreelancerRecord:
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")
    new_score = 0.9 if body.is_flagged else 0.2
    updated = await freelancer_repo.update(freelancer_id, {"fraud_score": new_score})
    return FreelancerRecord.model_validate(freelancer_to_dict(updated))
