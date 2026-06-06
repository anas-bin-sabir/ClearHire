"""
Fraud Detection Agent

Trigger:   freelancer.created event
Calls:     assess_fraud() from app.ai.bayesian  (unchanged)
           explain_fraud() from app.ai.explainer (unchanged)
Writes:    fraud_score -> PostgreSQL via FreelancerRepository
           full reasoning trace -> MongoDB ai_explanations collection

Agent classification (PEAS):
  Performance measure : minimise false negatives on fraudulent profiles
  Environment         : freelancer profile signals from event payload
  Actuators           : update fraud_score in Postgres, reasoning in MongoDB
  Sensors             : payload dict from event bus (no extra DB read needed)

Design note: agent directly accesses repositories. This is intentional for
this build. Future refactor: extract FraudService to separate domain logic
from orchestration. Agents become thin dispatchers; services own the logic.
"""
import logging
from datetime import datetime, timezone

from app.ai.bayesian import assess_fraud
from app.ai.explainer import explain_fraud
from app.ai.types import FraudExplanationInput, FreelancerCandidate
from app.core.config import settings
from app.core.events import ClearHireEvent, on
from app.db import mongodb as mongo_db
from app.db.session import async_session_factory
from app.db.repositories.postgres.freelancer_repository import FreelancerRepository

logger = logging.getLogger(__name__)


@on(ClearHireEvent.FREELANCER_CREATED)
async def run_fraud_pipeline(payload: dict) -> None:
    """
    Autonomous fraud analysis. Fires the moment a freelancer is created.
    Equivalent to the Slack agent's team_join handler — same pattern,
    different trigger and domain.

    The HTTP response for POST /freelancers has already returned to the
    client before this function runs. fraud_score starts at 0.0 and is
    updated here once Bayesian inference completes (~100–300ms without LLM,
    3–15s with Claude explanation).
    """
    freelancer_id = payload["freelancer_id"]
    t_start = datetime.now(timezone.utc)
    logger.info(f"[FraudAgent] Pipeline started — freelancer_id={freelancer_id}")

    # 1. Build typed FreelancerCandidate from event payload.
    #    All fields come from the emit() call in POST /freelancers.
    #    Field names match FreelancerCandidate exactly (verified from types.py).
    candidate = FreelancerCandidate(
        id=freelancer_id,
        name=payload.get("name", "Unknown"),
        skills=payload.get("skills", []),
        hourly_rate=float(payload.get("hourly_rate", 0.0)),
        experience_years=int(payload.get("experience_years", 0)),
        rating=float(payload.get("rating", 0.0)),
        review_count=int(payload.get("review_count", 0)),
        account_age_days=int(payload.get("account_age_days", 0)),
        portfolio_urls=payload.get("portfolio_urls", []),
        fraud_score=0.0,
        embedding_similarity=0.5,
        availability=True,
    )

    # 2. Bayesian fraud scoring — calls assess_fraud() from bayesian.py.
    #    Returns FraudAssessment with score, confidence, signals, contributions.
    #    This is synchronous and fast (~1ms). No change to bayesian.py.
    assessment = assess_fraud(candidate)

    # 3. LLM explanation — calls explain_fraud() from explainer.py.
    #    Falls back to deterministic explanation if Anthropic key is missing.
    #    explanation_struct.text is a @property on StructuredExplanation.
    explanation_struct = await explain_fraud(
        FraudExplanationInput(
            profile_name=candidate.name,
            assessment=assessment,
        )
    )

    # 4. Write fraud_score back to PostgreSQL.
    #    Uses async_session_factory directly — Depends() does not work
    #    outside FastAPI route handlers.
    async with async_session_factory() as session:
        repo = FreelancerRepository(session)
        freelancer = await repo.get_by_id(freelancer_id)
        if freelancer is not None:
            freelancer.fraud_score = assessment.score
            await session.commit()
            logger.debug(
                f"[FraudAgent] Postgres updated — "
                f"freelancer_id={freelancer_id} fraud_score={assessment.score:.3f}"
            )
        else:
            logger.warning(
                f"[FraudAgent] freelancer_id={freelancer_id} not found in Postgres — "
                "score not written"
            )

    # 5. Write full reasoning trace to MongoDB ai_explanations collection.
    #    Extra agent-specific fields go in metadata dict.
    collection = mongo_db.get_database()[mongo_db.COLLECTION_AI_EXPLANATIONS]
    await collection.insert_one({
        "endpoint": "/agents/fraud",
        "triggered_by": "freelancer.created",
        "entity_id": freelancer_id,
        "entity_type": "freelancer",
        "pipeline": "fraud_detection",
        "explanation": explanation_struct.text,
        "model": settings.anthropic_model,
        "system_prompt": "fraud_agent_autonomous",
        "user_prompt": candidate.name,
        "freelancer_id": freelancer_id,
        "metadata": {
            "score": assessment.score,
            "confidence": assessment.confidence.value,
            "is_flagged": assessment.is_flagged,
            "signals": assessment.signals,
            "risk_factors": assessment.risk_factors,
            "contributions": [c.model_dump() for c in assessment.contributions],
            "explanation_source": explanation_struct.source,
        },
        "ran_at": t_start,
        "timestamp": t_start,
    })

    elapsed_ms = int(
        (datetime.now(timezone.utc) - t_start).total_seconds() * 1000
    )
    logger.info(
        f"[FraudAgent] Pipeline complete — freelancer_id={freelancer_id} "
        f"score={assessment.score:.3f} flagged={assessment.is_flagged} "
        f"elapsed={elapsed_ms}ms"
    )
