import itertools
import random

from app.ai.team_solver import solve_team
from app.ai.types import FreelancerCandidate, TeamBuilderConstraints

SKILLS = ["Python", "React", "Docker", "ML", "Figma"]


def _pool(rng: random.Random, size: int) -> list[FreelancerCandidate]:
    return [
        FreelancerCandidate(
            id=i,
            name=f"F{i}",
            skills=rng.sample(SKILLS, rng.randint(1, 3)),
            hourly_rate=float(rng.randint(20, 120)),
            fraud_score=rng.choice([0.05, 0.1, 0.2, 0.8]),
            availability=rng.random() > 0.1,
        )
        for i in range(1, size + 1)
    ]


def _valid(team, c: TeamBuilderConstraints) -> bool:
    covered = {s for m in team for s in m.skills}
    cost = sum(m.hourly_rate * c.hours_per_member for m in team)
    return (
        len(team) == c.team_size
        and len({m.id for m in team}) == len(team)
        and set(c.required_skills) <= covered
        and cost <= c.budget
        and all(m.availability and m.fraud_score < c.max_fraud_score for m in team)
    )


def test_solution_satisfies_every_hard_constraint():
    pool = _pool(random.Random(1), 12)
    c = TeamBuilderConstraints(
        budget=12_000, required_skills=["Python", "React"], team_size=2, hours_per_member=40
    )
    result = solve_team(pool, c)
    assert result.solved
    assert _valid(result.team, c)
    assert result.total_cost == sum(m.hourly_rate * 40 for m in result.team)


def test_budget_conflict_is_diagnosed():
    pool = [
        FreelancerCandidate(id=1, name="A", skills=["Python"], hourly_rate=100),
        FreelancerCandidate(id=2, name="B", skills=["React"], hourly_rate=100),
    ]
    c = TeamBuilderConstraints(
        budget=1_000, required_skills=["Python", "React"], team_size=2, hours_per_member=40
    )
    result = solve_team(pool, c)
    assert not result.solved
    assert "budget conflict" in result.message


def test_missing_skill_is_diagnosed():
    pool = [FreelancerCandidate(id=1, name="A", skills=["Python"], hourly_rate=10)]
    c = TeamBuilderConstraints(budget=10_000, required_skills=["Python", "Rust"], team_size=1)
    result = solve_team(pool, c)
    assert not result.solved
    assert "Rust" in result.message


def test_solver_is_complete_against_brute_force():
    """Whenever any valid team exists, the solver must find one (and vice versa)."""
    rng = random.Random(42)
    for _ in range(150):
        pool = _pool(rng, rng.randint(3, 8))
        c = TeamBuilderConstraints(
            budget=float(rng.randint(2_000, 12_000)),
            required_skills=rng.sample(SKILLS, rng.randint(1, 3)),
            team_size=rng.randint(1, 3),
            hours_per_member=40,
        )
        exists = any(
            _valid(list(combo), c) for combo in itertools.combinations(pool, c.team_size)
        )
        result = solve_team(pool, c)
        assert result.solved == exists, (pool, c, result.message)
        if result.solved:
            assert _valid(result.team, c)
