from app.db.repositories.postgres import FreelancerRepository
from app.db.repositories.postgres.freelancer_repository import keyword_tsquery
from app.db.session import async_session_factory


async def _seed(make_freelancer):
    await make_freelancer(name="Py Dev", skills=["Python", "FastAPI"], bio="Python FastAPI backend APIs", hourly_rate=60)
    await make_freelancer(name="React Dev", skills=["React", "JavaScript"], bio="React frontend", hourly_rate=70)
    await make_freelancer(name="Pricey Py", skills=["Python"], bio="Python data", hourly_rate=150)
    await make_freelancer(name="Busy Py", skills=["Python"], bio="Python", availability=False)
    await make_freelancer(name="Risky Py", skills=["Python"], bio="Python", fraud_score=0.9)


async def test_query_search_returns_ranked_matches_with_similarity(client, make_freelancer):
    await _seed(make_freelancer)
    response = await client.post(
        "/search", json={"query": "Python FastAPI backend", "skills": ["Python"], "budget": 5000}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    results = body["freelancers"]
    scores = [r["match_score"] for r in results]
    assert scores == sorted(scores, reverse=True)
    assert body["explanation"]
    # Only 4 profiles have the must-have skill (< RESULT_LIMIT), so a relaxed pass
    # tops the shortlist up; the skill-less profile is labelled and ranked last.
    assert body["total_candidates"] == len(results) == 5
    assert body["retrieval"] == {"mode": "hybrid", "skill_filter": "relaxed"}
    assert results[-1]["name"] == "React Dev"
    assert results[-1]["retrieval"]["skill_filter"] == "relaxed"
    assert results[-1]["score_breakdown"]["missing_skills"] == ["Python"]
    assert {r["retrieval"]["skill_filter"] for r in results[:-1]} == {"strict"}


async def test_pgvector_similarity_reaches_the_ranker(client, make_freelancer):
    await _seed(make_freelancer)
    # With hash embeddings only identical text is "similar"; reuse Py Dev's profile text.
    exact = "Py Dev Python FastAPI backend APIs Python FastAPI Remote"
    response = await client.post("/search", json={"query": exact})
    top = response.json()["freelancers"][0]
    assert top["name"] == "Py Dev"
    assert abs(top["score_breakdown"]["semantic_similarity"] - 1.0) < 1e-4


async def test_hard_filters_are_applied_in_sql(client, make_freelancer):
    await _seed(make_freelancer)
    response = await client.post(
        "/search",
        json={"query": "python", "maxRate": 100, "availableOnly": True, "maxFraud": 0.5},
    )
    names = {r["name"] for r in response.json()["freelancers"]}
    assert names == {"Py Dev", "React Dev"}


async def test_search_without_query_or_skills_lists_candidates(client, make_freelancer):
    await _seed(make_freelancer)
    response = await client.post("/search", json={})
    assert response.status_code == 200
    assert len(response.json()["freelancers"]) == 5


async def test_search_is_recorded_once_in_history(client, make_freelancer):
    await _seed(make_freelancer)
    await client.post("/search", json={"query": "python"})
    recent = (await client.get("/activity/searches/recent")).json()["searches"]
    assert len(recent) == 1 and recent[0]["query"] == "python"


async def _retrieve(query, **kwargs):
    async with async_session_factory() as session:
        result = await FreelancerRepository(session).hybrid_retrieve(query, **kwargs)
        return result, [c.freelancer.name for c in result.candidates]


async def test_strict_skill_filter_holds_when_enough_matches(make_freelancer):
    await _seed(make_freelancer)
    result, names = await _retrieve("python", must_skills=["python"], min_results=2)
    assert result.skill_filter == "strict"
    assert "React Dev" not in names and len(names) == 4


async def test_keyword_channel_finds_bio_terms(make_freelancer):
    await make_freelancer(name="A", skills=["Go"], bio="Built HIPAA compliant telehealth APIs")
    await make_freelancer(name="B", skills=["Go"], bio="Payments and ledgers")
    result, names = await _retrieve("telehealth platform", mode="keyword")
    assert names == ["A"]
    top = result.candidates[0]
    assert top.keyword_rank == 1 and top.semantic_rank is None
    assert top.keyword_score == 1.0
    assert top.similarity is not None  # filled in even for keyword-only hits


async def test_skills_outweigh_bio_in_keyword_rank(make_freelancer):
    await make_freelancer(name="Mentions", skills=["Go"], bio="Curious about Kubernetes")
    await make_freelancer(name="Has skill", skills=["Kubernetes"], bio="Platform engineer")
    _, names = await _retrieve("kubernetes", mode="keyword")
    assert names == ["Has skill", "Mentions"]


async def test_rrf_rewards_agreement_between_channels(make_freelancer):
    profile = dict(skills=["Rust"], bio="embedded firmware for drones", location="Remote")
    both = await make_freelancer(name="Both", **profile)
    await make_freelancer(name="Keyword only", skills=["Rust"], bio="drones drones firmware")
    # Hash embeddings: only the exact profile text is similar, so "Both" tops the
    # vector channel and also matches keywords.
    exact = "Both embedded firmware for drones Rust Remote"
    result, names = await _retrieve(exact)
    assert names[0] == "Both"
    top = result.candidates[0]
    assert top.freelancer.id == both.id
    assert top.semantic_rank == 1 and top.keyword_rank is not None
    assert top.rrf_score > result.candidates[1].rrf_score


def test_keyword_tsquery_is_an_or_query_of_safe_terms():
    assert keyword_tsquery("React & Node.js, React!") == "react | node | js"
    assert keyword_tsquery("a ' | ! :*") == ""


async def test_nice_to_have_and_seniority_reach_the_ranker(client, make_freelancer):
    await make_freelancer(name="Junior", skills=["Python"], experience_years=1)
    await make_freelancer(name="Senior", skills=["Python", "Docker"], experience_years=8)
    response = await client.post(
        "/search",
        json={
            "skills": ["python"],
            "niceToHaveSkills": ["docker"],
            "seniorityLevel": "senior",
        },
    )
    assert response.status_code == 200, response.text
    results = response.json()["freelancers"]
    assert [r["name"] for r in results] == ["Senior", "Junior"]
    junior = results[1]["score_breakdown"]
    assert junior["missing_skills"] == ["Docker"]
    assert junior["must_have_coverage"] == 1.0
    assert junior["seniority_fit"] == 0.0


async def test_completed_contract_is_embedded_into_the_profile(
    client, make_user, make_freelancer, make_project
):
    user, headers = await make_user("client")
    freelancer = await make_freelancer(name="Worker")
    project = await make_project(user.id, title="Telehealth scheduling app")
    created = await client.post(
        "/contracts",
        json={"freelancer_id": freelancer.id, "project_id": project.id, "status": "active"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    before = list(freelancer.embedding)
    done = await client.patch(
        f"/contracts/{created.json()['id']}", json={"status": "completed"}, headers=headers
    )
    assert done.status_code == 200, done.text
    async with async_session_factory() as session:
        repo = FreelancerRepository(session)
        assert await repo.past_project_titles(freelancer.id) == ["Telehealth scheduling app"]
        refreshed = await repo.get_by_id(freelancer.id)
        assert list(refreshed.embedding) != before
