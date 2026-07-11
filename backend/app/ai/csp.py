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
    """Forward checking: can the remaining slots still satisfy budget and skills?

    Every bound here must be optimistic (never prune a branch that has a valid
    completion); one freelancer may cover several missing skills at once.
    """
    hours = constraints.hours_per_member
    current_cost = _team_cost(team, hours)
    remaining_budget = constraints.budget - current_cost
    if remaining_budget < 0:
        return False

    uncovered = _uncovered_skills(team, constraints.required_skills)
    if remaining_slots <= 0:
        return not uncovered

    assigned_ids = {m.id for m in team}
    available = [
        f
        for f in pool
        if f.id not in assigned_ids and _trust_score(f, constraints.max_fraud_score)
    ]
    if len(available) < remaining_slots:
        return False

    # Every slot must be filled: the cheapest possible fill is a lower bound on cost.
    cheapest_fill = sorted(_member_cost(f, hours) for f in available)[:remaining_slots]
    if sum(cheapest_fill) > remaining_budget:
        return False

    # Each missing skill needs at least one available holder ...
    if any(not any(skill in f.skills for f in available) for skill in uncovered):
        return False
    # ... and the open slots need enough combined skill capacity to cover them all.
    capacity = sorted(
        (len(set(f.skills) & set(uncovered)) for f in available), reverse=True
    )[:remaining_slots]
    return sum(capacity) >= len(uncovered)


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

