from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.ai.bayesian import assess_fraud
from app.ai.explainer import explain_fraud
from app.ai.types import FraudExplanationInput, FreelancerCandidate
from app.core.activity import log_activity
from app.core.config import settings
from app.core.dependencies import get_ai_explanation_repo, get_freelancer_repo
from app.core.rate_limit import enforce_public_rate_limit
from app.db.repositories.mongo import AIExplanationRepository
from app.db.repositories.postgres import FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import FraudRequest, FraudResponse

router = APIRouter(dependencies=[Depends(enforce_public_rate_limit)])


def _fraud_response_from_cache(
    cached: dict[str, Any],
    profile_dict: Optional[dict[str, Any]] = None,
) -> FraudResponse:
    metadata = cached.get("metadata") or {}
    return FraudResponse(
        score=float(metadata.get("score", 0.0)),
        confidence=metadata.get("confidence", "low"),
        signals=metadata.get("signals", []),
        risk_factors=metadata.get("risk_factors", []),
        is_flagged=bool(metadata.get("is_flagged", False)),
        freelancer=profile_dict,
        explanation=cached.get("explanation", ""),
        source="agent_precomputed",
        ran_at=cached.get("ran_at"),
        note="Result computed automatically when freelancer signed up",
    )


async def _get_precomputed_fraud(
    freelancer_id: int,
    ai_explanation_repo: AIExplanationRepository,
    freelancer_repo: FreelancerRepository,
) -> Optional[FraudResponse]:
    cached = await ai_explanation_repo.get_latest(
        entity_id=freelancer_id,
        entity_type="freelancer",
        pipeline="fraud_detection",
    )
    if not cached:
        return None
    profile_dict: Optional[dict[str, Any]] = None
    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is not None:
        profile_dict = freelancer_to_dict(freelancer)
    return _fraud_response_from_cache(cached, profile_dict)


@router.get("/{freelancer_id}", response_model=FraudResponse)
async def get_fraud_analysis(
    freelancer_id: int,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> FraudResponse:
    """Return pre-computed fraud analysis from the fraud agent when available."""
    cached = await _get_precomputed_fraud(
        freelancer_id, ai_explanation_repo, freelancer_repo
    )
    if cached:
        return cached

    freelancer = await freelancer_repo.get_by_id(freelancer_id)
    if freelancer is None:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    return await analyze_fraud(
        FraudRequest(freelancer_id=freelancer_id),
        freelancer_repo=freelancer_repo,
        ai_explanation_repo=ai_explanation_repo,
    )


@router.post("", response_model=FraudResponse)
async def analyze_fraud(
    body: FraudRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> FraudResponse:
    endpoint = "/fraud"
    try:
        if body.freelancer_id is not None:
            cached = await _get_precomputed_fraud(
                body.freelancer_id, ai_explanation_repo, freelancer_repo
            )
            if cached:
                return cached

        if body.freelancer_id is not None:
            freelancer = await freelancer_repo.get_by_id(body.freelancer_id)
            if freelancer is None:
                raise HTTPException(status_code=404, detail="Freelancer not found")
            profile_dict = freelancer_to_dict(freelancer)
        else:
            if body.name is None:
                raise HTTPException(
                    status_code=400,
                    detail="Provide freelancer_id or inline profile fields",
                )
            profile_dict = {
                "id": 0,
                "name": body.name,
                "account_age_days": body.account_age_days or 0,
                "rating": body.rating or 0.0,
                "hourly_rate": body.hourly_rate or 0.0,
                "experience_years": body.experience_years or 0,
                "review_count": body.review_count or 0,
                "portfolio_urls": body.portfolio_urls or [],
                "skills": body.skills or [],
            }

        profile = FreelancerCandidate.from_dict(profile_dict)
        assessment = assess_fraud(profile)

        explanation_struct = await explain_fraud(
            FraudExplanationInput(
                profile_name=profile.name,
                assessment=assessment,
            )
        )
        explanation = explanation_struct.text

        await ai_explanation_repo.insert(
            endpoint=endpoint,
            explanation=explanation,
            model=settings.anthropic_model,
            system_prompt="fraud",
            user_prompt=profile.name,
            freelancer_id=profile.id or None,
            metadata={
                "score": assessment.score,
                "is_flagged": assessment.is_flagged,
                "source": explanation_struct.source,
            },
        )

        response = FraudResponse(
            score=assessment.score,
            confidence=assessment.confidence.value,
            signals=assessment.signals,
            risk_factors=assessment.risk_factors,
            is_flagged=assessment.is_flagged,
            freelancer=profile_dict,
            explanation=explanation,
        )

        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(exclude_none=True),
            response_summary={
                "score": assessment.score,
                "is_flagged": assessment.is_flagged,
            },
        )
        return response
    except HTTPException:
        raise
    except Exception as exc:
        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(exclude_none=True),
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc
