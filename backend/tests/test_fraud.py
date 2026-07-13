from app.ai.fraud import score_fraud
from app.ai.types import ConfidenceLevel, FreelancerCandidate


def test_established_profile_is_low_risk():
    profile = FreelancerCandidate(
        id=1, name="A", account_age_days=900, rating=4.6, review_count=30,
        hourly_rate=60, experience_years=8,
    )
    assessment = score_fraud(profile)
    assert not assessment.is_flagged
    assert assessment.score < 0.3


def test_new_account_alone_is_low_confidence_not_flagged():
    profile = FreelancerCandidate(id=2, name="New", account_age_days=3)
    assessment = score_fraud(profile)
    assert not assessment.is_flagged
    assert assessment.confidence == ConfidenceLevel.LOW
    assert "Insufficient history for a high-confidence judgment" in assessment.risk_factors


def test_stacked_signals_are_flagged_with_contributions():
    profile = FreelancerCandidate(
        id=3, name="Sus", account_age_days=10, portfolio_urls=["https://x.dev"],
        review_count=60, rating=4.97, hourly_rate=180, experience_years=1,
    )
    assessment = score_fraud(profile)
    assert assessment.is_flagged
    assert {"rate_experience_mismatch", "review_anomaly", "copied_portfolio"} <= set(
        assessment.signals
    )
    active = [c for c in assessment.contributions if c.active]
    assert active and all(c.log_likelihood_ratio != 0 for c in active)
