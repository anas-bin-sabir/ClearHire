"""AI layer entry points: one module per capability."""

from app.ai.explainer import explain_fraud, explain_search, explain_team
from app.ai.fraud import score_fraud
from app.ai.ranking import rank_freelancers
from app.ai.team_solver import solve_team
from app.ai.types import (
    FraudAssessment,
    FreelancerCandidate,
    ProjectConstraints,
    RankedFreelancer,
    RankingResult,
    StructuredExplanation,
    TeamBuilderConstraints,
    TeamBuilderResult,
)

__all__ = [
    "FreelancerCandidate",
    "ProjectConstraints",
    "TeamBuilderConstraints",
    "RankedFreelancer",
    "RankingResult",
    "FraudAssessment",
    "TeamBuilderResult",
    "StructuredExplanation",
    "rank_freelancers",
    "score_fraud",
    "solve_team",
    "explain_search",
    "explain_fraud",
    "explain_team",
]
