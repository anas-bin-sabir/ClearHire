"""Deterministic ranking. Not an LLM and not a learned model."""

from __future__ import annotations

from app.ai.types import (
    RankingResult,
    FreelancerCandidate,
    ProjectConstraints,
    RankedFreelancer,
    RankingWeights,
    ScoreBreakdown,
)
from app.core.config import settings

# A nice-to-have skill counts half as much as a must-have in skill coverage.
NICE_TO_HAVE_WEIGHT = 0.5
# Credit for an adjacent skill is its relationship weight times this, so even a
# near-interchangeable skill (weight 0.8) earns less than the exact one.
ADJACENT_CREDIT_SCALE = 0.75
# Years of experience each seniority level expects: (minimum, typical maximum).
SENIORITY_BANDS: dict[str, tuple[int, int]] = {
    "junior": (0, 2),
    "mid": (3, 5),
    "senior": (6, 9),
    "lead": (10, 99),
}


def default_weights() -> RankingWeights:
    return RankingWeights(
        semantic=settings.rank_semantic,
        keyword=settings.rank_keyword,
        skill=settings.rank_skill,
        experience=settings.rank_experience,
        rating=settings.rank_rating,
        budget=settings.rank_budget,
        availability=settings.rank_availability,
        fraud=settings.rank_fraud,
    )


class _SkillMatch:
    __slots__ = ("coverage", "must_coverage", "matched", "adjacent", "missing")

    def __init__(self) -> None:
        self.coverage = 1.0
        self.must_coverage = 1.0
        self.matched: list[str] = []
        self.adjacent: dict[str, str] = {}
        self.missing: list[str] = []


def _skill_credit(
    skill: str, have: dict[str, str], related: dict[str, dict[str, float]]
) -> tuple[float, str | None]:
    """(credit, candidate skill that earned it): 1.0 exact, partial if adjacent."""
    key = skill.lower()
    if key in have:
        return 1.0, have[key]
    best, via = 0.0, None
    for neighbour, weight in related.get(key, {}).items():
        if neighbour in have and weight > best:
            best, via = weight, have[neighbour]
    return best * ADJACENT_CREDIT_SCALE, via


def _skill_match(
    must: list[str],
    nice: list[str],
    candidate_skills: list[str],
    related: dict[str, dict[str, float]],
) -> _SkillMatch:
    match = _SkillMatch()
    have = {s.lower(): s for s in candidate_skills}
    must_keys = {s.lower() for s in must}
    nice = [s for s in nice if s.lower() not in must_keys]
    weighted = [(s, 1.0) for s in must] + [(s, NICE_TO_HAVE_WEIGHT) for s in nice]
    if not weighted:
        return match
    earned = must_earned = 0.0
    for skill, weight in weighted:
        credit, via = _skill_credit(skill, have, related)
        earned += weight * credit
        if weight == 1.0:
            must_earned += credit
        if credit == 1.0:
            match.matched.append(skill)
        elif via:
            match.adjacent[skill] = via
        else:
            match.missing.append(skill)
    match.coverage = earned / sum(w for _, w in weighted)
    match.must_coverage = must_earned / len(must) if must else 1.0
    return match


def _seniority_fit(years: int, level: str | None) -> float | None:
    """1.0 at or above the level's band; linear falloff over 4 years below it."""
    if not level or level not in SENIORITY_BANDS:
        return None
    minimum, _ = SENIORITY_BANDS[level]
    if years >= minimum:
        return 1.0
    return max(0.0, 1.0 - (minimum - years) / 4.0)


def _budget_fit(
    hourly_rate: float,
    budget: float,
    team_size: int,
    hours: float,
    budget_type: str = "fixed",
) -> float:
    if budget <= 0 or team_size <= 0 or hours <= 0:
        return 0.5
    # Hourly budgets are already a per-member rate cap.
    share = budget if budget_type == "hourly" else budget / (team_size * hours)
    if share <= 0:
        return 0.0
    if hourly_rate <= share:
        return 1.0
    overrun = (hourly_rate - share) / share
    return max(0.0, 1.0 - min(1.0, overrun))


def _experience_score(years: int) -> float:
    return min(1.0, max(0.0, years / 10.0))


def _rating_score(rating: float) -> float:
    return min(1.0, max(0.0, rating / 5.0))


def score_candidate(
    candidate: FreelancerCandidate,
    project: ProjectConstraints,
    weights: RankingWeights | None = None,
) -> tuple[float, ScoreBreakdown]:
    w = (weights or default_weights()).normalized()
    skills = _skill_match(
        project.required_skills,
        project.nice_to_have_skills,
        candidate.skills,
        project.related_skills,
    )
    skill = skills.coverage
    budget = _budget_fit(
        candidate.hourly_rate,
        project.budget,
        project.team_size,
        project.hours_per_engagement,
        project.budget_type,
    )
    seniority = _seniority_fit(candidate.experience_years, project.seniority_level)
    experience = (
        seniority if seniority is not None else _experience_score(candidate.experience_years)
    )
    rating = _rating_score(candidate.rating)
    availability = 1.0 if candidate.availability else 0.0
    fraud_trust = 1.0 - min(1.0, max(0.0, candidate.fraud_score))
    semantic = min(1.0, max(0.0, candidate.embedding_similarity))
    keyword = min(1.0, max(0.0, candidate.keyword_score))

    total = (
        w.semantic * semantic
        + w.keyword * keyword
        + w.skill * skill
        + w.experience * experience
        + w.rating * rating
        + w.budget * budget
        + w.availability * availability
        + w.fraud * fraud_trust
    )
    breakdown = ScoreBreakdown(
        skill_gap=round(1.0 - skill, 6),
        budget_deviation=round(1.0 - budget, 6),
        fraud_penalty=round(1.0 - fraud_trust, 6),
        embedding_distance=round(1.0 - semantic, 6),
        total_cost=round(candidate.hourly_rate * project.hours_per_engagement, 2),
        skill_coverage=round(skill, 6),
        semantic_similarity=round(semantic, 6),
        experience=round(experience, 6),
        rating=round(rating, 6),
        budget_fit=round(budget, 6),
        availability=round(availability, 6),
        fraud_trust=round(fraud_trust, 6),
        keyword_relevance=round(keyword, 6),
        must_have_coverage=round(skills.must_coverage, 6),
        seniority_fit=None if seniority is None else round(seniority, 6),
        matched_skills=skills.matched,
        adjacent_skills=skills.adjacent,
        missing_skills=skills.missing,
    )
    return round(total, 6), breakdown


def rank_freelancers(
    candidates: list[FreelancerCandidate],
    project: ProjectConstraints,
    weights: RankingWeights | None = None,
) -> RankingResult:
    scored: list[tuple[float, int, FreelancerCandidate, ScoreBreakdown]] = []
    for candidate in candidates:
        total, breakdown = score_candidate(candidate, project, weights)
        scored.append((total, candidate.id, candidate, breakdown))
    scored.sort(key=lambda row: (-row[0], row[1]))

    ranked: list[RankedFreelancer] = []
    for index, (total, _, candidate, breakdown) in enumerate(scored, start=1):
        ranked.append(
            RankedFreelancer(
                candidate=candidate,
                match_score=round(total * 100.0, 2),
                rank_score=total,
                f_score=round(1.0 - total, 6),
                rank=index,
                breakdown=breakdown,
            )
        )
    return RankingResult(ranked=ranked, total_candidates=len(candidates))
