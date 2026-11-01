import pytest

from app.ai.rerank import (
    LLMClaim,
    LLMComparison,
    LLMJudgement,
    LLMRerankOutput,
    ProjectContext,
    Reasoning,
    blend,
    cache_key,
    candidate_card,
    deterministic_comparisons,
    deterministic_reasoning,
    ground_output,
)
from app.ai.ranking import rank_freelancers
from app.ai.skill_taxonomy import related_skill_map
from app.ai.types import FreelancerCandidate, ProjectConstraints
from tests.test_extraction import _api_error, _message, fake_claude  # noqa: F401

PROJECT = ProjectConstraints(
    required_skills=["Kubernetes"],
    budget=4000.0,
    related_skills=related_skill_map([("Docker", "Kubernetes", 0.6)]),
)
CONTEXT = ProjectContext(brief="k8s", must_have_skills=["Kubernetes"], budget=4000.0)


def _ranked():
    pool = [
        FreelancerCandidate(id=1, name="Exact", skills=["Kubernetes"], rating=4.8,
                            review_count=10, hourly_rate=50, experience_years=6),
        FreelancerCandidate(id=2, name="Adjacent", skills=["Docker"], rating=4.0,
                            review_count=1, hourly_rate=150, experience_years=2),
        FreelancerCandidate(id=3, name="None", skills=["Figma"], rating=3.0, hourly_rate=40),
    ]
    return rank_freelancers(pool, PROJECT).ranked


def _cards(ranked):
    return {r.candidate.id: candidate_card(r, [(7, "Cluster migration")] if r.candidate.id == 1 else [])
            for r in ranked}


def _claim(text, *refs):
    return LLMClaim(text=text, evidence=list(refs))


# --- grounding ---------------------------------------------------------------


def test_claims_without_resolvable_evidence_are_stripped():
    ranked = _ranked()
    output = LLMRerankOutput(
        judgements=[
            LLMJudgement(
                freelancer_id=1, fit_score=140, biggest_gap=None,
                strengths=[
                    _claim("Knows Kubernetes", "f1.skills"),
                    _claim("Migrated clusters", "f1.project:7"),
                    _claim("Invented project", "f1.project:99"),   # not on the card
                    _claim("Cites someone else", "f2.skills"),     # wrong candidate
                    _claim("Unknown field", "f1.salary"),
                    _claim("No evidence"),
                ],
                risks=[],
            ),
            LLMJudgement(freelancer_id=42, fit_score=90, strengths=[], risks=[], biggest_gap=None),
        ],
        comparisons=[
            LLMComparison(preferred_id=1, other_id=42, reason="x", evidence=["f1.skills"]),
        ],
    )
    reasoning, comparisons, stripped = ground_output(output, _cards(ranked))
    assert set(reasoning) == {1}
    assert [c.text for c in reasoning[1].strengths] == ["Knows Kubernetes", "Migrated clusters"]
    assert reasoning[1].fit_score == 100.0  # clamped
    assert comparisons == []
    assert stripped == 5  # 4 claims + 1 comparison with an unjudged candidate


def test_comparison_refs_may_cite_either_candidate():
    ranked = _ranked()
    output = LLMRerankOutput(
        judgements=[
            LLMJudgement(freelancer_id=i, fit_score=50, strengths=[], risks=[], biggest_gap=None)
            for i in (1, 2)
        ],
        comparisons=[
            LLMComparison(preferred_id=1, other_id=2, reason="Has the exact skill",
                          evidence=["f1.skills", "f2.skills", "f3.skills"]),
        ],
    )
    _, comparisons, stripped = ground_output(output, _cards(ranked))
    assert comparisons[0].evidence == ["f1.skills", "f2.skills"]
    assert stripped == 0


GRAPH_2 = {
    "skill_paths": [{"required": "Kubernetes", "via": "Docker", "hops": 1, "weight": 0.6,
                     "path": ["Docker", "Kubernetes"]}],
    "past_projects": [{"id": 11, "title": "Container platform", "shared_skills": ["Kubernetes"]}],
    "collaborations": [{"other_id": 1, "other_name": "Exact", "project_ids": [7], "count": 1,
                        "avg_rating": 4.8}],
}


def _graph_cards(ranked):
    return {
        r.candidate.id: candidate_card(
            r, [(7, "Cluster migration")] if r.candidate.id in (1, 2) else [],
            GRAPH_2 if r.candidate.id == 2 else None,
        )
        for r in ranked
    }


def test_graph_refs_are_validated_against_the_card():
    ranked = _ranked()
    output = LLMRerankOutput(
        judgements=[
            LLMJudgement(
                freelancer_id=2, fit_score=70, biggest_gap=None,
                strengths=[
                    _claim("Docker is one hop from Kubernetes", "f2.graph:path:Kubernetes"),
                    _claim("Case-insensitive skill", "f2.graph:path:kubernetes"),
                    _claim("Shipped with #1", "f2.graph:collab:1", "f2.project:7"),
                    _claim("Similar past project", "f2.project:11"),  # from graph.past_projects
                    _claim("No such path", "f2.graph:path:Rust"),
                    _claim("No such collaborator", "f2.graph:collab:3"),
                    _claim("Someone else's graph", "f1.graph:path:Kubernetes"),
                    _claim("Malformed", "f2.graph:collab:x"),
                ],
                risks=[],
            ),
            LLMJudgement(
                freelancer_id=1, fit_score=90, biggest_gap=None, risks=[],
                strengths=[_claim("Card has no graph", "f1.graph:collab:2")],
            ),
        ],
        comparisons=[],
    )
    reasoning, _, stripped = ground_output(output, _graph_cards(ranked))
    assert [c.text for c in reasoning[2].strengths] == [
        "Docker is one hop from Kubernetes", "Case-insensitive skill",
        "Shipped with #1", "Similar past project",
    ]
    assert reasoning[2].strengths[2].evidence == ["f2.graph:collab:1", "f2.project:7"]
    assert reasoning[1].strengths == []
    assert stripped == 5


def test_deterministic_reasoning_emits_graph_claims():
    ranked = {r.candidate.id: r for r in _ranked()}
    reasoning = deterministic_reasoning(ranked[2], CONTEXT, GRAPH_2, {7: "Cluster migration"})
    by_ref = {ref: c.text for c in reasoning.strengths for ref in c.evidence}
    assert "Docker → Kubernetes" in by_ref["f2.graph:path:Kubernetes"]
    assert by_ref["f2.graph:collab:1"] == (
        "Worked with Exact (#1) on 'Cluster migration' (avg 4.8★)"
    )
    assert "f2.project:7" in {r for c in reasoning.strengths for r in c.evidence}
    assert "Container platform" in by_ref["f2.project:11"]
    # The path is not claimed twice (adjacency claim already carries it).
    assert sum("f2.graph:path:Kubernetes" in c.evidence for c in reasoning.strengths) == 1
    # Every emitted ref passes the server-side grounding check.
    cards = _graph_cards(list(ranked.values()))
    output = LLMRerankOutput(
        judgements=[LLMJudgement(freelancer_id=2, fit_score=50, biggest_gap=None, risks=[],
                                 strengths=[LLMClaim(text=c.text, evidence=c.evidence)
                                            for c in reasoning.strengths])],
        comparisons=[],
    )
    _, _, stripped = ground_output(output, cards)
    assert stripped == 0


def test_cache_key_changes_with_graph_facts():
    ranked = _ranked()
    plain = [candidate_card(r) for r in ranked]
    graphed = [candidate_card(r, None, GRAPH_2 if r.candidate.id == 2 else None) for r in ranked]
    more = dict(GRAPH_2, collaborations=GRAPH_2["collaborations"] * 2)
    changed = [candidate_card(r, None, more if r.candidate.id == 2 else None) for r in ranked]
    keys = {cache_key(CONTEXT, cards) for cards in (plain, graphed, changed)}
    assert len(keys) == 3


# --- blending ----------------------------------------------------------------


def test_blend_reorders_the_head_and_keeps_the_tail():
    ranked = _ranked()  # deterministic order: 1, 2, 3
    assert [r.candidate.id for r in ranked] == [1, 2, 3]
    reasoning = {1: Reasoning(fit_score=0.0), 2: Reasoning(fit_score=100.0)}
    out = blend(ranked, reasoning, alpha=0.2, top_n=2)
    assert [c.ranked.candidate.id for c in out] == [2, 1, 3]
    assert [c.ranked.rank for c in out] == [1, 2, 3]
    two = next(c for c in out if c.ranked.candidate.id == 2)
    assert two.final_score == pytest.approx(0.2 * ranked[1].rank_score + 0.8)
    assert out[2].final_score == ranked[2].rank_score


def test_alpha_one_keeps_the_deterministic_order():
    ranked = _ranked()
    reasoning = {1: Reasoning(fit_score=0.0), 2: Reasoning(fit_score=100.0)}
    out = blend(ranked, reasoning, alpha=1.0, top_n=3)
    assert [c.ranked.candidate.id for c in out] == [1, 2, 3]


# --- deterministic path ------------------------------------------------------


def test_deterministic_reasoning_names_the_biggest_gap():
    ranked = {r.candidate.id: r for r in _ranked()}
    adjacent = deterministic_reasoning(ranked[2], CONTEXT)
    assert adjacent.biggest_gap == "no Kubernetes; has Docker"
    assert any("adjacent" in c.text for c in adjacent.strengths)
    assert {c.evidence[0] for c in adjacent.risks} >= {"f2.hourly_rate", "f2.review_count"}
    assert deterministic_reasoning(ranked[3], CONTEXT).biggest_gap == "missing Kubernetes"
    assert deterministic_reasoning(ranked[1], CONTEXT).biggest_gap is None


def test_deterministic_comparisons_explain_each_consecutive_pair():
    comparisons = deterministic_comparisons(_ranked())
    assert [(c.preferred_id, c.other_id) for c in comparisons] == [(1, 2), (2, 3)]
    assert "required skills" in comparisons[0].reason


# --- API ---------------------------------------------------------------------


async def _seed(make_freelancer):
    exact = await make_freelancer(name="Exact", skills=["Kubernetes"], bio="Runs clusters",
                                  rating=4.8, review_count=12)
    adjacent = await make_freelancer(name="Adjacent", skills=["Docker"], bio="Containers",
                                     rating=4.0, review_count=2)
    return exact, adjacent


def _llm_prefers(preferred_id: int, other_id: int):
    output = LLMRerankOutput(
        judgements=[
            LLMJudgement(freelancer_id=preferred_id, fit_score=98, biggest_gap=None,
                         strengths=[_claim("Strong container background", f"f{preferred_id}.bio")],
                         risks=[_claim("Made up", "f999.skills")]),
            LLMJudgement(freelancer_id=other_id, fit_score=5, biggest_gap="weak fit",
                         strengths=[], risks=[_claim("Thin profile", f"f{other_id}.bio")]),
        ],
        comparisons=[LLMComparison(preferred_id=preferred_id, other_id=other_id,
                                   reason="Better fit", evidence=[f"f{preferred_id}.bio"])],
    )

    def behaviour(kwargs):
        if "output_format" in kwargs:
            return _message(parsed=output)
        return _message(text="Summary.\n- a\n- b\n- c")

    return behaviour


async def test_search_reranks_with_grounded_llm_reasoning(client, make_freelancer, fake_claude):
    exact, adjacent = await _seed(make_freelancer)
    messages = fake_claude(_llm_prefers(adjacent.id, exact.id))
    response = await client.post("/search", json={"query": "kubernetes", "skills": ["Kubernetes"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reranking"]["path"] == "llm"
    assert body["reranking"]["cached"] is False
    assert body["reranking"]["stripped_claims"] == 1
    results = body["freelancers"]
    # Deterministically "Exact" wins (it has the must-have skill); the LLM fit flips it.
    assert [r["name"] for r in results] == ["Adjacent", "Exact"]
    assert results[0]["deterministic_match_score"] < results[1]["deterministic_match_score"]
    assert results[0]["reasoning"]["fit_score"] == 98
    assert results[0]["reasoning"]["risks"] == []  # the ungrounded claim was stripped
    assert body["reranking"]["comparisons"][0]["preferred_id"] == adjacent.id

    rerank_calls = [c for c in messages.calls if "output_format" in c]
    assert len(rerank_calls) == 1
    system = rerank_calls[0]["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}


async def test_repeat_search_is_served_from_the_rerank_cache(client, make_freelancer, fake_claude):
    exact, adjacent = await _seed(make_freelancer)
    messages = fake_claude(_llm_prefers(adjacent.id, exact.id))
    payload = {"query": "kubernetes", "skills": ["Kubernetes"]}
    await client.post("/search", json=payload)
    second = (await client.post("/search", json=payload)).json()
    assert second["reranking"]["cached"] is True
    assert second["freelancers"][0]["name"] == "Adjacent"
    assert len([c for c in messages.calls if "output_format" in c]) == 1


async def test_llm_failure_falls_back_to_deterministic(client, make_freelancer, fake_claude):
    await _seed(make_freelancer)

    def behaviour(kwargs):
        raise _api_error(529)

    fake_claude(behaviour)
    body = (await client.post("/search", json={"query": "kubernetes", "skills": ["Kubernetes"]})).json()
    assert body["reranking"]["path"] == "deterministic"
    assert body["reranking"]["error"] == "API error 529"
    assert [r["name"] for r in body["freelancers"]] == ["Exact", "Adjacent"]
    assert body["freelancers"][1]["reasoning"]["biggest_gap"] == "no Kubernetes; has Docker"


async def test_rerank_can_be_turned_off_per_request(client, make_freelancer, fake_claude):
    await _seed(make_freelancer)
    messages = fake_claude(lambda kw: _message(text="Summary.\n- a"))
    body = (await client.post("/search", json={"query": "kubernetes", "rerank": False})).json()
    assert body["reranking"]["path"] == "deterministic"
    assert not [c for c in messages.calls if "output_format" in c]


async def test_without_a_key_search_reasons_deterministically(client, make_freelancer):
    await _seed(make_freelancer)
    body = (await client.post("/search", json={"skills": ["Kubernetes"]})).json()
    assert body["reranking"]["path"] == "deterministic"
    top = body["freelancers"][0]
    assert top["match_score"] == top["deterministic_match_score"]
    assert top["reasoning"]["strengths"][0]["evidence"] == [f"f{top['id']}.skills"]


async def test_project_creation_precomputes_matches(client, make_user, make_freelancer):
    await _seed(make_freelancer)
    _, headers = await make_user("client")
    created = await client.post(
        "/projects",
        json={"title": "Kubernetes platform", "required_skills": ["Kubernetes"],
              "budget": 8000, "deadline_days": 30, "team_size": 1},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["project"]["id"]
    body = (await client.get(f"/search/precomputed/{project_id}")).json()
    assert body["precomputed"] is True
    assert body["reranking"]["path"] == "deterministic"
    assert [r["name"] for r in body["ranked_freelancers"]][0] == "Exact"


async def test_precomputed_is_empty_for_unknown_project(client):
    body = (await client.get("/search/precomputed/12345")).json()
    assert body == {
        "precomputed": False,
        "project_id": 12345,
        "ranked_freelancers": [],
        "message": "No precomputed matches yet; run /search for live results.",
    }

