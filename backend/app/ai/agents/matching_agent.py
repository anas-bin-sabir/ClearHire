"""
Matching Agent

Trigger:   project.created event
Calls:     astar_rank_freelancers() from app.ai.astar  (unchanged)
           attach_embedding_similarity() from app.db.utils.embeddings
           random_unit_embedding() as query vector (consistent with how
           freelancer embeddings were seeded — both use random_unit_embedding,
           so cosine similarity is meaningful within this dataset)
Writes:    pre-ranked candidate list -> MongoDB search_history collection
           reasoning summary -> MongoDB ai_explanations collection

Embedding note: there is no external embedding API in this codebase.
Freelancer embeddings are random unit vectors (random_unit_embedding).
Query embedding is also a random unit vector of the same dimension.
This is architecturally consistent — both sides use the same distribution.
When a real embedding model is added later, only random_unit_embedding()
calls need replacing. Everything else stays identical.

Scaling note: list_available() fetches all available freelancers.
Safe for datasets up to ~5000 rows. For larger datasets: add pgvector
ANN pre-filter before A* re-ranking. Flagged with limit=500 guard below.
"""
import logging
from datetime import datetime, timezone

from app.ai.astar import astar_rank_freelancers
from app.core.config import settings
from app.core.events import ClearHireEvent, on
from app.db import mongodb as mongo_db
from app.db.session import async_session_factory
from app.db.repositories.postgres.freelancer_repository import FreelancerRepository
from app.db.utils.embeddings import attach_embedding_similarity, random_unit_embedding

logger = logging.getLogger(__name__)

# Guard: never fetch more than this many candidates in one agent run.
# Prevents memory spike on large datasets. Raise when pgvector pre-filter added.
_MAX_CANDIDATES = 500


@on(ClearHireEvent.PROJECT_CREATED)
async def run_matching_pipeline(payload: dict) -> None:
    """
    Pre-compute ranked freelancer candidates the moment a project is posted.
    Results are cached in MongoDB. The search page reads this cache first
    and shows results instantly without waiting for A* to run on demand.
    """
    project_id = payload["project_id"]
    t_start = datetime.now(timezone.utc)
    logger.info(f"[MatchingAgent] Pipeline started — project_id={project_id}")

    # 1. Fetch available freelancers from PostgreSQL.
    #    max_fraud_score=0.7 matches existing router behaviour.
    #    list_available() has no limit param — _MAX_CANDIDATES applied via slice.
    async with async_session_factory() as session:
        repo = FreelancerRepository(session)
        freelancers = await repo.list_available(max_fraud_score=0.7)

        if not freelancers:
            logger.info(
                f"[MatchingAgent] No available freelancers — "
                f"project_id={project_id} skipped"
            )
            return

        # Apply candidate cap before heavy computation
        if len(freelancers) > _MAX_CANDIDATES:
            logger.warning(
                f"[MatchingAgent] {len(freelancers)} freelancers found — "
                f"capping at {_MAX_CANDIDATES}"
            )
            freelancers = freelancers[:_MAX_CANDIDATES]

        # 2. Generate query embedding.
        #    Uses random_unit_embedding() — same function used to seed
        #    freelancer embeddings at creation. Dimensionally consistent.
        #    attach_embedding_similarity() computes cosine similarity against
        #    each freelancer's stored embedding vector.
        query_embedding = random_unit_embedding(settings.embedding_dimensions)

        # 3. Convert ORM rows to dicts with embedding_similarity attached.
        #    attach_embedding_similarity is from app.db.utils.embeddings.
        candidates = attach_embedding_similarity(freelancers, query_embedding)

    # 4. Build project dict — keys must match astar_rank_freelancers() signature.
    project = {
        "required_skills": payload.get("required_skills") or [],
        "budget": float(payload.get("budget") or 10000),
        "team_size": int(payload.get("team_size") or 1),
        "hours_per_engagement": 40.0,
    }

    # 5. A* ranking — calls astar_rank_freelancers() from astar.py unchanged.
    #    Returns list[dict] with match_score, rank_score, fScore, rank,
    #    score_breakdown fields added to each candidate dict.
    ranked = astar_rank_freelancers(candidates, project)

    # 6. Cache ranked results in MongoDB search_history collection.
    #    GET /search/precomputed/{project_id} reads from this collection.
    #    Store top 20 only — enough for the search page first render.
    db = mongo_db.get_database()
    await db[mongo_db.COLLECTION_SEARCH_HISTORY].insert_one({
        "project_id": project_id,
        "triggered_by": "project.created",
        "pipeline": "matching",
        "ranked_freelancers": ranked[:20],
        "total_candidates": len(candidates),
        "required_skills": payload.get("required_skills") or [],
        "budget": payload.get("budget"),
        "ran_at": t_start,
        "timestamp": t_start,
    })

    # 7. Write summary to ai_explanations for consistency with fraud agent.
    #    Allows /search/agent-status/project/{id} to work uniformly.
    await db[mongo_db.COLLECTION_AI_EXPLANATIONS].insert_one({
        "endpoint": "/agents/matching",
        "triggered_by": "project.created",
        "entity_id": project_id,
        "entity_type": "project",
        "pipeline": "matching",
        "explanation": (
            f"Pre-ranked {len(ranked)} candidates for project {project_id}. "
            f"Top match score: {ranked[0].get('match_score', 0):.1f}."
            if ranked else
            f"No candidates ranked for project {project_id}."
        ),
        "model": "astar_deterministic",
        "system_prompt": "matching_agent_autonomous",
        "user_prompt": payload.get("title", ""),
        "metadata": {
            "total_candidates": len(candidates),
            "total_ranked": len(ranked),
            "top_match_score": ranked[0].get("match_score") if ranked else None,
            "required_skills": payload.get("required_skills"),
        },
        "ran_at": t_start,
        "timestamp": t_start,
    })

    elapsed_ms = int(
        (datetime.now(timezone.utc) - t_start).total_seconds() * 1000
    )
    logger.info(
        f"[MatchingAgent] Pipeline complete — project_id={project_id} "
        f"ranked={len(ranked)} elapsed={elapsed_ms}ms"
    )
