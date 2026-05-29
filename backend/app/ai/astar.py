"""A* ranking: skill gap, budget fit, fraud penalty, embedding similarity."""

import heapq

from app.ai.types import (
    AStarRankingResult,
    FreelancerCandidate,
    ProjectConstraints,
    RankedFreelancer,
    RankingWeights,
    ScoreBreakdown,
)


def _skill_gap_score(required: list[str], candidate_skills: list[str]) -> float:
    if not required:
        return 0.0
    skill_set = set(candidate_skills)
    missing = sum(1 for skill in required if skill not in skill_set)
    return missing / len(required)


def _budget_deviation_score(
    hourly_rate: float,
    budget: float,
    team_size: int,
    hours: float,
) -> float:
    if budget <= 0 or team_size <= 0 or hours <= 0:
        return 1.0
    target_rate = budget / (team_size * hours)
    if target_rate <= 0:
        return 0.0
    projected_cost = hourly_rate * hours
    budget_share = budget / team_size
    if projected_cost <= budget_share:
        return 0.0
    overrun = (projected_cost - budget_share) / budget_share
    return min(1.0, overrun)


def _fraud_penalty_score(fraud_score: float) -> float:
    return min(1.0, max(0.0, fraud_score))


def _embedding_distance_score(similarity: float) -> float:
    clamped = min(1.0, max(0.0, similarity))
    return 1.0 - clamped


def _compute_breakdown(
    candidate: FreelancerCandidate,
    project: ProjectConstraints,
) -> ScoreBreakdown:
    skill = _skill_gap_score(project.required_skills, candidate.skills)
    budget = _budget_deviation_score(
        candidate.hourly_rate,
        project.budget,
        project.team_size,
        project.hours_per_engagement,
    )
    fraud = _fraud_penalty_score(candidate.fraud_score)
    embedding = _embedding_distance_score(candidate.embedding_similarity)
    total_cost = candidate.hourly_rate * project.hours_per_engagement
    return ScoreBreakdown(
        skill_gap=round(skill, 6),
        budget_deviation=round(budget, 6),
        fraud_penalty=round(fraud, 6),
        embedding_distance=round(embedding, 6),
        total_cost=round(total_cost, 2),
    )


def _compute_f_score(breakdown: ScoreBreakdown, weights: RankingWeights) -> float:
    w = weights.normalized()
    return (
        w.skill_gap * breakdown.skill_gap
        + w.budget * breakdown.budget_deviation
        + w.fraud * breakdown.fraud_penalty
        + w.embedding * breakdown.embedding_distance
    )


def rank_freelancers(
    candidates: list[FreelancerCandidate],
    project: ProjectConstraints,
    weights: RankingWeights | None = None,
) -> AStarRankingResult:
    """
    Rank candidates with A* cost f(n) = weighted sum of constraint violations.
    Lower f_score is better. match_score = (1 - f_score) * 100.
    """
    if weights is None:
        weights = RankingWeights()

    heap: list[tuple[float, int, int, FreelancerCandidate, ScoreBreakdown]] = []

    for candidate in candidates:
        breakdown = _compute_breakdown(candidate, project)
        f_score = _compute_f_score(breakdown, weights)
        heapq.heappush(
            heap,
            (f_score, -candidate.id, candidate.id, candidate, breakdown),
        )

    ranked: list[RankedFreelancer] = []
    rank = 1
    while heap:
        f_score, _, _, candidate, breakdown = heapq.heappop(heap)
        rank_score = round(max(0.0, 1.0 - f_score), 6)
        match_score = round(rank_score * 100.0, 2)
        ranked.append(
            RankedFreelancer(
                candidate=candidate,
                match_score=match_score,
                rank_score=rank_score,
                f_score=round(f_score, 6),
                rank=rank,
                breakdown=breakdown,
            )
        )
        rank += 1

    return AStarRankingResult(ranked=ranked, total_candidates=len(candidates))


def astar_rank_freelancers(
    candidates: list[dict],
    project: dict,
    weights: dict[str, float] | None = None,
) -> list[dict]:
    """Backward-compatible adapter for routers expecting list[dict]."""
    typed_candidates = [FreelancerCandidate.from_dict(c) for c in candidates]
    typed_project = ProjectConstraints(
        required_skills=project.get("required_skills") or [],
        budget=float(project.get("budget") or 10000),
        team_size=int(project.get("team_size") or 1),
        hours_per_engagement=float(project.get("hours_per_engagement") or 40),
    )
    typed_weights = None
    if weights:
        typed_weights = RankingWeights(
            skill_gap=weights.get("skill", 0.35),
            budget=weights.get("rate", weights.get("budget", 0.25)),
            fraud=weights.get("fraud", 0.25),
            embedding=weights.get("embedding", 0.15),
        )
    result = rank_freelancers(typed_candidates, typed_project, typed_weights)
    return [r.to_api_dict() for r in result.ranked]
