"""CSP team builder: backtracking, forward checking, budget pruning."""

from app.ai.types import (
    FreelancerCandidate,
    TeamBuilderConstraints,
    TeamBuilderResult,
    TeamBuilderStats,
)


def _trust_score(candidate: FreelancerCandidate, max_fraud: float) -> bool:
    return candidate.fraud_score < max_fraud


def _member_cost(candidate: FreelancerCandidate, hours: int) -> float:
    return candidate.hourly_rate * hours


def _team_cost(team: list[FreelancerCandidate], hours: int) -> float:
    return sum(_member_cost(member, hours) for member in team)


def _skills_covered(
    team: list[FreelancerCandidate],
    required: list[str],
) -> set[str]:
    covered: set[str] = set()
    for member in team:
        covered.update(member.skills)
    return covered


def _uncovered_skills(
    team: list[FreelancerCandidate],
    required: list[str],
) -> list[str]:
    covered = _skills_covered(team, required)
    return [skill for skill in required if skill not in covered]


def _forward_check_feasible(
    team: list[FreelancerCandidate],
    remaining_slots: int,
    pool: list[FreelancerCandidate],
    constraints: TeamBuilderConstraints,
) -> bool:
    """Forward checking: can remaining slots cover budget and skills?"""
    hours = constraints.hours_per_member
    current_cost = _team_cost(team, hours)
    remaining_budget = constraints.budget - current_cost
    if remaining_budget < 0:
        return False

    uncovered = _uncovered_skills(team, constraints.required_skills)
    if not uncovered and len(team) >= constraints.team_size:
        return True

    # Cheapest trustworthy extension for each uncovered skill
    trustworthy = [
        f for f in pool if _trust_score(f, constraints.max_fraud_score)
    ]
    if remaining_slots <= 0:
        return len(uncovered) == 0 and current_cost <= constraints.budget

    min_extra_cost = 0.0
    assigned_ids = {m.id for m in team}

    for skill in uncovered:
        candidates_for_skill = [
            f
            for f in trustworthy
            if f.id not in assigned_ids and skill in f.skills
        ]
        if not candidates_for_skill:
            return False
        cheapest = min(candidates_for_skill, key=lambda f: (f.hourly_rate, f.id))
        min_extra_cost += _member_cost(cheapest, hours)
        assigned_ids.add(cheapest.id)

    if min_extra_cost > remaining_budget:
        return False

    max_possible_cost = current_cost + remaining_slots * max(
        (_member_cost(f, hours) for f in trustworthy),
        default=0.0,
    )
    if max_possible_cost < current_cost and len(team) < constraints.team_size:
        return True

    return min_extra_cost <= remaining_budget


def _order_candidates(
    pool: list[FreelancerCandidate],
    target_skill: str | None,
    required: list[str],
    assigned_ids: set[int],
) -> list[FreelancerCandidate]:
    required_set = set(required)

    def sort_key(candidate: FreelancerCandidate) -> tuple:
        overlap = len(set(candidate.skills) & required_set)
        has_target = 1 if target_skill and target_skill in candidate.skills else 0
        return (-has_target, -overlap, candidate.hourly_rate, candidate.id)

    return sorted(
        [f for f in pool if f.id not in assigned_ids],
        key=sort_key,
    )


def solve_team(
    freelancers: list[FreelancerCandidate],
    constraints: TeamBuilderConstraints,
) -> TeamBuilderResult:
    stats = TeamBuilderStats()
    required = list(constraints.required_skills)
    hours = constraints.hours_per_member

    pool = [
        f for f in freelancers if _trust_score(f, constraints.max_fraud_score)
    ]
    pool.sort(key=lambda f: (f.hourly_rate, f.id))

    if not pool or not required or constraints.team_size < 1:
        return TeamBuilderResult(
            solved=False,
            message="Invalid input: empty pool, skills, or team size.",
            uncovered_skills=required,
        )

    best_team: list[FreelancerCandidate] | None = None

    def backtrack(team: list[FreelancerCandidate]) -> bool:
        nonlocal best_team

        if len(team) == constraints.team_size:
            uncovered = _uncovered_skills(team, required)
            if uncovered:
                return False
            if _team_cost(team, hours) > constraints.budget:
                return False
            best_team = list(team)
            return True

        remaining_slots = constraints.team_size - len(team)
        if not _forward_check_feasible(team, remaining_slots, pool, constraints):
            stats.forward_prunes += 1
            return False

        uncovered = _uncovered_skills(team, required)
        target_skill = uncovered[0] if uncovered else None
        assigned_ids = {member.id for member in team}

        for candidate in _order_candidates(pool, target_skill, required, assigned_ids):
            stats.nodes_explored += 1

            if candidate.id in assigned_ids:
                continue
            if not _trust_score(candidate, constraints.max_fraud_score):
                continue

            projected = team + [candidate]
            if _team_cost(projected, hours) > constraints.budget:
                stats.forward_prunes += 1
                continue

            team.append(candidate)
            if backtrack(team):
                return True
            team.pop()
            stats.backtracks += 1

        return False

    solved = backtrack([])

    if not solved or best_team is None:
        return TeamBuilderResult(
            solved=False,
            message=(
                "No valid team configuration found within budget, skill, "
                "and trust constraints."
            ),
            stats=stats,
            uncovered_skills=_uncovered_skills([], required),
        )

    total = _team_cost(best_team, hours)
    return TeamBuilderResult(
        solved=True,
        team=best_team,
        total_cost=round(total, 2),
        message="Team assembled successfully.",
        stats=stats,
    )


def solve_team_csp(
    freelancers: list[dict],
    budget: float,
    required_skills: list[str],
    team_size: int,
    hours_per_member: int = 40,
    min_trust_score: float = 0.0,
    max_fraud_score: float | None = None,
) -> dict:
    """Backward-compatible adapter."""
    if max_fraud_score is None:
        max_fraud_score = (
            round(1.0 - min_trust_score, 6) if min_trust_score > 0 else 0.6
        )
    constraints = TeamBuilderConstraints(
        budget=budget,
        required_skills=required_skills,
        team_size=team_size,
        hours_per_member=hours_per_member,
        max_fraud_score=max_fraud_score,
    )
    typed = [FreelancerCandidate.from_dict(f) for f in freelancers]
    result = solve_team(typed, constraints)
    return {
        "solved": result.solved,
        "team": result.team_as_dicts(),
        "total_cost": result.total_cost,
        "backtracks": result.stats.backtracks,
        "nodes_explored": result.stats.nodes_explored,
        "forward_prunes": result.stats.forward_prunes,
        "message": result.message,
        "uncovered_skills": result.uncovered_skills,
    }
