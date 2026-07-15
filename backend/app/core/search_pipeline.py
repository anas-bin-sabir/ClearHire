"""Retrieve-then-rank pipeline shared by POST /search and the offline eval."""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.ranking import rank_freelancers
from app.ai.types import (
    FreelancerCandidate,
    ProjectConstraints,
    RankedFreelancer,
    RankingWeights,
)
from app.db.repositories.postgres import FreelancerRepository, SkillRelationshipRepository
from app.db.repositories.postgres.freelancer_repository import RetrievalMode, RetrievalResult
from app.models.schemas import SearchRequest

RETRIEVAL_LIMIT = 100
RESULT_LIMIT = 20


@dataclass
class SearchOutcome:
    retrieval: RetrievalResult
    candidates: list[FreelancerCandidate]
    ranked: list[RankedFreelancer]  # every shortlisted candidate, best first


async def run_search(
    body: SearchRequest,
    freelancers: FreelancerRepository,
    relationships: SkillRelationshipRepository,
    *,
    mode: RetrievalMode = "hybrid",
    weights: RankingWeights | None = None,
) -> SearchOutcome:
    # Stage 1: hard filters in SQL, then pgvector ANN + full-text channels fused
    # with Reciprocal Rank Fusion.
    retrieval_text = body.query.strip() or " ".join(body.skills + body.nice_to_have_skills)
    retrieval = await freelancers.hybrid_retrieve(
        retrieval_text,
        must_skills=body.skills,
        mode=mode,
        limit=RETRIEVAL_LIMIT,
        min_results=RESULT_LIMIT,
        max_fraud_score=body.max_fraud,
        min_rate=body.min_rate,
        max_rate=body.max_rate,
        min_rating=body.min_rating,
        available_only=body.available_only,
    )
    candidates = [
        FreelancerCandidate.from_dict(row)
        for row in freelancers.to_ranked_dicts(retrieval.candidates)
    ]

    # Stage 2: deterministic constraint ranking on the shortlist only.
    project = ProjectConstraints(
        required_skills=body.skills,
        nice_to_have_skills=body.nice_to_have_skills,
        budget=body.budget,
        budget_type=body.budget_type,
        team_size=body.team_size,
        hours_per_engagement=40.0,
        seniority_level=body.seniority_level,
        related_skills=await relationships.adjacency(),
    )
    ranked = rank_freelancers(candidates, project, weights).ranked
    return SearchOutcome(retrieval=retrieval, candidates=candidates, ranked=ranked)
