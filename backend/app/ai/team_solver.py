"""Deterministic constraint team solver (no LLM, no graph DB)."""

from __future__ import annotations

from app.ai.csp import (
    _skills_covered,
    _team_cost,
    _uncovered_skills,
    solve_team as _solve_team,
)
from app.ai.types import FreelancerCandidate, TeamBuilderConstraints, TeamBuilderResult


def _failure_message(
    pool: list[FreelancerCandidate],
    constraints: TeamBuilderConstraints,
) -> tuple[str, list[str]]:
    available = [f for f in pool if f.availability]
    if len(available) < constraints.team_size:
        return (
            "team-size conflict: not enough available candidates",
            ["Increase team size flexibility", "Relax availability"],
        )
    uncovered = _uncovered_skills(available, constraints.required_skills)
    if uncovered:
        return (
            f"missing skills: {', '.join(uncovered)}",
            [f"Drop required skill {skill}" for skill in uncovered[:3]]
            + ["Widen the candidate pool"],
        )
    cheapest = sorted(available, key=lambda f: f.hourly_rate)[: constraints.team_size]
    min_cost = _team_cost(cheapest, constraints.hours_per_member)
    if min_cost > constraints.budget:
        return (
            "budget conflict: cheapest valid-sized team exceeds budget",
            [
                f"Raise budget above {round(min_cost, 2)}",
                "Reduce hours_per_member",
                "Reduce team_size",
            ],
        )
    return (
        "No valid team configuration found within budget, skill, and trust constraints.",
        ["Relax max_fraud_score", "Increase budget", "Reduce team_size"],
    )


def solve_team(
    freelancers: list[FreelancerCandidate],
    constraints: TeamBuilderConstraints,
) -> TeamBuilderResult:
    pool = [
        f
        for f in freelancers
        if f.availability and f.fraud_score < constraints.max_fraud_score
    ]
    result = _solve_team(pool, constraints)
    if result.solved:
        covered = _skills_covered(result.team, constraints.required_skills)
        missing = [s for s in constraints.required_skills if s not in covered]
        if missing:
            result.solved = False
            result.team = []
            result.uncovered_skills = missing
            result.message = f"missing skills: {', '.join(missing)}"
            return result
        return result

    message, suggestions = _failure_message(pool, constraints)
    result.message = message
    if suggestions:
        result.message = f"{message}. Suggested relaxation: {'; '.join(suggestions)}"
    if not result.uncovered_skills:
        result.uncovered_skills = _uncovered_skills([], constraints.required_skills)
    return result
