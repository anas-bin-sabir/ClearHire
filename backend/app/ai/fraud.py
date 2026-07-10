"""Deterministic fraud scoring. New accounts get lower confidence, not auto high-risk."""

from __future__ import annotations

from app.ai.bayesian import FLAG_THRESHOLD, assess_fraud as _assess_fraud
from app.ai.types import ConfidenceLevel, FraudAssessment, FreelancerCandidate


def score_fraud(profile: FreelancerCandidate) -> FraudAssessment:
    assessment = _assess_fraud(profile)
    signals = set(assessment.signals)
    new_account = profile.account_age_days < 30 or "new_account" in signals
    only_newness = new_account and signals <= {"new_account", "no_verified_id"}

    if only_newness:
        assessment = assessment.model_copy(
            update={
                "confidence": ConfidenceLevel.LOW,
                "is_flagged": False,
            }
        )
        if assessment.score >= FLAG_THRESHOLD:
            assessment = assessment.model_copy(update={"score": min(assessment.score, 0.45)})
        if "Insufficient history for a high-confidence judgment" not in assessment.risk_factors:
            assessment.risk_factors.append(
                "Insufficient history for a high-confidence judgment"
            )

    return assessment


def assess_fraud(profile: FreelancerCandidate) -> FraudAssessment:
    return score_fraud(profile)
