"""
Team Builder Agent

Trigger:   team.build_requested event
Status:    Skeleton — logs event and writes to MongoDB.
           CSP solver (csp.py) is called synchronously in the existing
           team_builder router. This agent is the hook for future async
           CSP runs when constraints are expensive to solve.
           Extend run_team_pipeline() to call csp.py when needed.
"""
import logging
from datetime import datetime, timezone

from app.core.events import ClearHireEvent, on
from app.db import mongodb as mongo_db

logger = logging.getLogger(__name__)


@on(ClearHireEvent.TEAM_BUILD_REQUESTED)
async def run_team_pipeline(payload: dict) -> None:
    project_id = payload.get("project_id")
    t_start = datetime.now(timezone.utc)
    logger.info(f"[TeamAgent] Event received — project_id={project_id}")

    try:
        db = mongo_db.get_database()
        await db[mongo_db.COLLECTION_AI_EXPLANATIONS].insert_one({
            "endpoint": "/agents/team",
            "triggered_by": "team.build_requested",
            "entity_id": project_id,
            "entity_type": "team_request",
            "pipeline": "csp_team_builder",
            "explanation": "Team build event received. CSP ran synchronously in router.",
            "model": "csp_deterministic",
            "system_prompt": "team_agent_autonomous",
            "user_prompt": str(payload.get("required_skills", [])),
            "metadata": payload,
            "ran_at": t_start,
            "timestamp": t_start,
        })
        logger.info(f"[TeamAgent] Event logged — project_id={project_id}")
    except Exception as exc:
        logger.error(f"[TeamAgent] Failed — project_id={project_id}: {exc}")
        raise
