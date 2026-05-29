"""Bayesian fraud model with log-likelihood ratios (deterministic)."""

import math
from dataclasses import dataclass

from app.ai.types import (
    ConfidenceLevel,
    FraudAssessment,
    FraudSignalContribution,
    FreelancerCandidate,
)


@dataclass(frozen=True)
class SignalDefinition:
    signal_id: str
    label: str
    likelihood_fraud: float
    likelihood_legit: float

    @property
    def log_likelihood_ratio(self) -> float:
        if self.likelihood_fraud <= 0 or self.likelihood_legit <= 0:
            return 0.0
        return math.log(self.likelihood_fraud / self.likelihood_legit)


PRIOR_FRAUD_PROBABILITY = 0.05

SIGNAL_DEFINITIONS: tuple[SignalDefinition, ...] = (
    SignalDefinition("new_account", "New account (< 30 days)", 0.75, 0.20),
    SignalDefinition(
        "copied_portfolio",
        "Portfolio present on young account",
        0.85,
        0.05,
    ),
    SignalDefinition(
        "review_anomaly",
        "Suspiciously perfect review history",
        0.70,
        0.10,
    ),
    SignalDefinition("no_verified_id", "Identity not verified", 0.60, 0.30),
    SignalDefinition("low_response_rate", "Low response rate", 0.50, 0.20),
    SignalDefinition(
        "rate_experience_mismatch",
        "Rate exceeds experience band",
        0.80,
        0.15,
    ),
    SignalDefinition(
        "stored_high_fraud_score",
        "Platform fraud score elevated",
        0.90,
        0.25,
    ),
)

FLAG_THRESHOLD = 0.65


def _prior_log_odds() -> float:
    p = PRIOR_FRAUD_PROBABILITY
    return math.log(p / (1.0 - p))


def _log_odds_to_probability(log_odds: float) -> float:
    if log_odds >= 0:
        exp_pos = math.exp(-log_odds)
        return 1.0 / (1.0 + exp_pos)
    exp_neg = math.exp(log_odds)
    return exp_neg / (1.0 + exp_neg)


def _confidence_from_score(score: float) -> ConfidenceLevel:
    if score >= 0.7 or score <= 0.3:
        return ConfidenceLevel.HIGH
    if score >= 0.55 or score <= 0.4:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def _evaluate_signal(
    definition: SignalDefinition,
    profile: FreelancerCandidate,
) -> bool:
    if definition.signal_id == "new_account":
        return profile.account_age_days < 30
    if definition.signal_id == "copied_portfolio":
        return len(profile.portfolio_urls) > 0 and profile.account_age_days < 60
    if definition.signal_id == "review_anomaly":
        return profile.review_count > 50 and profile.rating > 4.9
    if definition.signal_id == "no_verified_id":
        return not profile.verified_id
    if definition.signal_id == "low_response_rate":
        return profile.response_rate < 0.3
    if definition.signal_id == "rate_experience_mismatch":
        return profile.hourly_rate > 150 and profile.experience_years < 2
    if definition.signal_id == "stored_high_fraud_score":
        return profile.fraud_score >= 0.6
    return False


def assess_fraud(profile: FreelancerCandidate) -> FraudAssessment:
    """
    Naive Bayes with log-likelihood ratios:
      log_odds_posterior = log_odds_prior + sum(LLR_i) for active signals
    """
    prior_log_odds = _prior_log_odds()
    posterior_log_odds = prior_log_odds
    contributions: list[FraudSignalContribution] = []
    active_signals: list[str] = []
    risk_factors: list[str] = []

    for definition in SIGNAL_DEFINITIONS:
        active = _evaluate_signal(definition, profile)
        llr = definition.log_likelihood_ratio if active else 0.0
        if active:
            posterior_log_odds += llr
            active_signals.append(definition.signal_id)
            risk_factors.append(definition.label)
        contributions.append(
            FraudSignalContribution(
                signal_id=definition.signal_id,
                label=definition.label,
                active=active,
                likelihood_ratio=round(math.exp(llr), 6) if active else 1.0,
                log_likelihood_ratio=round(llr, 6),
            )
        )

    score = round(_log_odds_to_probability(posterior_log_odds), 4)
    confidence = _confidence_from_score(score)

    if not risk_factors and score > 0.5:
        risk_factors.append("Elevated posterior fraud probability")

    return FraudAssessment(
        score=score,
        confidence=confidence,
        is_flagged=score >= FLAG_THRESHOLD,
        prior_log_odds=round(prior_log_odds, 6),
        posterior_log_odds=round(posterior_log_odds, 6),
        signals=active_signals,
        risk_factors=risk_factors,
        contributions=contributions,
    )


def compute_fraud_score(profile: dict) -> dict:
    """Backward-compatible adapter for routers expecting dict output."""
    assessment = assess_fraud(FreelancerCandidate.from_dict(profile))
    return {
        "score": assessment.score,
        "confidence": assessment.confidence.value,
        "signals": assessment.signals,
        "risk_factors": assessment.risk_factors,
        "is_flagged": assessment.is_flagged,
        "prior_log_odds": assessment.prior_log_odds,
        "posterior_log_odds": assessment.posterior_log_odds,
        "contributions": [c.model_dump() for c in assessment.contributions],
    }
