"""
Agent Orchestrator

Called once during FastAPI lifespan startup via register_all_agents().
Importing each agent module triggers its @on() decorators, which registers
the handler functions with the event bus. Nothing else is needed.
"""
import importlib
import logging

logger = logging.getLogger(__name__)

_AGENT_MODULES = (
    "app.ai.agents.fraud_agent",
    "app.ai.agents.matching_agent",
    "app.ai.agents.team_agent",
)


def register_all_agents() -> None:
    """
    Register all autonomous agents with the ClearHire event bus.
    Must be called before the application starts serving requests.
    Order does not matter — all agents subscribe independently.
    """
    for module in _AGENT_MODULES:
        importlib.import_module(module)
    logger.info(
        "[Orchestrator] All agents registered: "
        "fraud_agent(freelancer.created), "
        "matching_agent(project.created), "
        "team_agent(team.build_requested)"
    )
