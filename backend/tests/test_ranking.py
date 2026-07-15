from app.ai.ranking import rank_freelancers
from app.ai.skill_taxonomy import related_skill_map
from app.ai.types import FreelancerCandidate, ProjectConstraints


def _candidate(id: int, **fields) -> FreelancerCandidate:
    base = dict(
        id=id,
        name=f"F{id}",
        skills=["Python"],
        rating=4.0,
        hourly_rate=50.0,
        experience_years=5,
        fraud_score=0.1,
        embedding_similarity=0.5,
    )
    base.update(fields)
    return FreelancerCandidate(**base)


PROJECT = ProjectConstraints(
    required_skills=["Python", "React"], budget=4000.0, team_size=1, hours_per_engagement=40
)


def test_full_skill_coverage_outranks_partial():
    full = _candidate(1, skills=["Python", "React"])
    partial = _candidate(2, skills=["Python"])
    ranked = rank_freelancers([partial, full], PROJECT).ranked
    assert [r.candidate.id for r in ranked] == [1, 2]
    assert ranked[0].breakdown.skill_coverage == 1.0
    assert ranked[1].breakdown.skill_coverage == 0.5


def test_skill_match_is_case_insensitive():
    ranked = rank_freelancers([_candidate(1, skills=["python", "REACT"])], PROJECT).ranked
    assert ranked[0].breakdown.skill_coverage == 1.0


def test_semantic_similarity_breaks_ties():
    near = _candidate(1, embedding_similarity=0.9)
    far = _candidate(2, embedding_similarity=0.1)
    ranked = rank_freelancers([far, near], PROJECT).ranked
    assert ranked[0].candidate.id == 1


def test_rate_over_budget_share_is_penalized():
    cheap = _candidate(1, hourly_rate=80.0)  # share is 4000 / 40 = 100/h
    pricey = _candidate(2, hourly_rate=190.0)
    ranked = rank_freelancers([pricey, cheap], PROJECT).ranked
    assert ranked[0].candidate.id == 1
    assert ranked[0].breakdown.budget_fit == 1.0
    assert ranked[1].breakdown.budget_fit < 0.2


def test_ranking_is_deterministic_and_scored_0_to_100():
    pool = [_candidate(i, rating=4.0) for i in range(1, 6)]
    first = rank_freelancers(pool, PROJECT).ranked
    second = rank_freelancers(list(reversed(pool)), PROJECT).ranked
    assert [r.candidate.id for r in first] == [r.candidate.id for r in second]
    assert [r.rank for r in first] == [1, 2, 3, 4, 5]
    assert all(0 <= r.match_score <= 100 for r in first)


def test_nice_to_have_counts_half_of_a_must_have():
    project = PROJECT.model_copy(
        update={"required_skills": ["Python"], "nice_to_have_skills": ["Docker"]}
    )
    ranked = rank_freelancers([_candidate(1, skills=["Python"])], project).ranked
    breakdown = ranked[0].breakdown
    assert breakdown.skill_coverage == round(1 / 1.5, 6)
    assert breakdown.must_have_coverage == 1.0
    assert breakdown.missing_skills == ["Docker"]


def test_adjacent_skill_earns_partial_credit():
    project = PROJECT.model_copy(
        update={
            "required_skills": ["Next.js"],
            "related_skills": related_skill_map([("React", "Next.js", 0.8)]),
        }
    )
    adjacent = _candidate(1, skills=["React"])
    exact = _candidate(2, skills=["Next.js"])
    unrelated = _candidate(3, skills=["Go"])
    ranked = {r.candidate.id: r.breakdown for r in rank_freelancers(
        [adjacent, exact, unrelated], project
    ).ranked}
    assert ranked[2].skill_coverage == 1.0
    assert ranked[1].skill_coverage == 0.6  # 0.8 * ADJACENT_CREDIT_SCALE
    assert ranked[1].adjacent_skills == {"Next.js": "React"}
    assert ranked[3].skill_coverage == 0.0 and ranked[3].missing_skills == ["Next.js"]


def test_curated_adjacency_is_symmetric_and_known():
    adjacency = related_skill_map()
    assert adjacency["next.js"]["react"] == adjacency["react"]["next.js"]
    assert "kubernetes" in adjacency["docker"]


def test_seniority_fit_replaces_raw_experience_when_level_given():
    project = PROJECT.model_copy(update={"seniority_level": "senior"})
    pool = [_candidate(1, experience_years=12), _candidate(2, experience_years=4),
            _candidate(3, experience_years=1)]
    fits = {r.candidate.id: r.breakdown.seniority_fit for r in rank_freelancers(pool, project).ranked}
    assert fits == {1: 1.0, 2: 0.5, 3: 0.0}
    no_level = rank_freelancers(pool, PROJECT).ranked
    assert all(r.breakdown.seniority_fit is None for r in no_level)


def test_hourly_budget_is_a_rate_cap_not_a_total():
    project = PROJECT.model_copy(update={"budget": 60.0, "budget_type": "hourly"})
    ranked = {r.candidate.id: r.breakdown.budget_fit for r in rank_freelancers(
        [_candidate(1, hourly_rate=55.0), _candidate(2, hourly_rate=90.0)], project
    ).ranked}
    assert ranked[1] == 1.0
    assert ranked[2] == 0.5  # 50% over the cap
