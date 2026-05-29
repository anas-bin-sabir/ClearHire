from fastapi import APIRouter, Depends, HTTPException

from app.ai.bayesian import assess_fraud
from app.ai.explainer import explain_fraud
from app.ai.types import FraudExplanationInput, FreelancerCandidate
from app.core.activity import log_activity
from app.core.config import settings
from app.core.dependencies import get_ai_explanation_repo, get_freelancer_repo
from app.db.repositories.mongo import AIExplanationRepository
from app.db.repositories.postgres import FreelancerRepository
from app.db.utils.serializers import freelancer_to_dict
from app.models.schemas import FraudRequest, FraudResponse

router = APIRouter()


@router.post("", response_model=FraudResponse)
async def analyze_fraud(
    body: FraudRequest,
    freelancer_repo: FreelancerRepository = Depends(get_freelancer_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> FraudResponse:
    endpoint = "/fraud"
    try:
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
