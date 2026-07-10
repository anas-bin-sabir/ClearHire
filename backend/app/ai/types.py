"""Typed inputs and outputs for the ClearHire intelligence layer."""

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# --- Shared ---


class FreelancerCandidate(BaseModel):
    id: int
    name: str
    skills: list[str] = Field(default_factory=list)
    rating: float = 0.0
    hourly_rate: float = 0.0
    experience_years: int = 0
    account_age_days: int = 0
    fraud_score: float = 0.0
    embedding_similarity: float = Field(default=0.5, ge=0.0, le=1.0)
    keyword_score: float = Field(default=0.0, ge=0.0, le=1.0)
    bio: str | None = None
    location: str | None = None
    availability: bool = True
    review_count: int = 0
    portfolio_urls: list[str] = Field(default_factory=list)
    verified_id: bool = False
    response_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    extra: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FreelancerCandidate":
        known = cls.model_fields.keys()
        payload = {k: v for k, v in data.items() if k in known}
        extra = {k: v for k, v in data.items() if k not in known}
        if extra:
            payload["extra"] = extra
        return cls.model_validate(payload)


SeniorityLevel = Literal["junior", "mid", "senior", "lead"]


class ProjectConstraints(BaseModel):
    required_skills: list[str] = Field(default_factory=list)  # must-haves
    nice_to_have_skills: list[str] = Field(default_factory=list)
    budget: float = Field(gt=0)
    # fixed: total for the engagement; hourly: max rate per member per hour.
    budget_type: Literal["fixed", "hourly"] = "fixed"
    team_size: int = Field(default=1, ge=1)
    hours_per_engagement: float = Field(default=40.0, gt=0)
    seniority_level: SeniorityLevel | None = None
    # {skill_lower: {related_skill_lower: weight}} for partial skill credit.
    related_skills: dict[str, dict[str, float]] = Field(default_factory=dict)


class RankingWeights(BaseModel):
    semantic: float = Field(default=0.35, ge=0.0)
    keyword: float = Field(default=0.0, ge=0.0)
    skill: float = Field(default=0.25, ge=0.0)
    experience: float = Field(default=0.10, ge=0.0)
    rating: float = Field(default=0.10, ge=0.0)
    budget: float = Field(default=0.10, ge=0.0)
    availability: float = Field(default=0.05, ge=0.0)
    fraud: float = Field(default=0.05, ge=0.0)

    def normalized(self) -> "RankingWeights":
        total = (
            self.semantic
            + self.keyword
            + self.skill
            + self.experience
            + self.rating
            + self.budget
            + self.availability
            + self.fraud
        )
        if total <= 0:
            return RankingWeights()
        return RankingWeights(
            semantic=self.semantic / total,
            keyword=self.keyword / total,
            skill=self.skill / total,
            experience=self.experience / total,
            rating=self.rating / total,
            budget=self.budget / total,
            availability=self.availability / total,
            fraud=self.fraud / total,
        )


class ScoreBreakdown(BaseModel):
    skill_gap: float = Field(ge=0.0, le=1.0)
    budget_deviation: float = Field(ge=0.0, le=1.0)
    fraud_penalty: float = Field(ge=0.0, le=1.0)
    embedding_distance: float = Field(ge=0.0, le=1.0)
    total_cost: float = Field(ge=0.0)
    skill_coverage: float = Field(default=0.0, ge=0.0, le=1.0)
    semantic_similarity: float = Field(default=0.0, ge=0.0, le=1.0)
    experience: float = Field(default=0.0, ge=0.0, le=1.0)
    rating: float = Field(default=0.0, ge=0.0, le=1.0)
    budget_fit: float = Field(default=0.0, ge=0.0, le=1.0)
    availability: float = Field(default=0.0, ge=0.0, le=1.0)
    fraud_trust: float = Field(default=0.0, ge=0.0, le=1.0)
    keyword_relevance: float = Field(default=0.0, ge=0.0, le=1.0)
    must_have_coverage: float = Field(default=1.0, ge=0.0, le=1.0)
    seniority_fit: float | None = Field(default=None, ge=0.0, le=1.0)
    matched_skills: list[str] = Field(default_factory=list)
    # required skill -> the candidate skill that earned partial credit for it
    adjacent_skills: dict[str, str] = Field(default_factory=dict)
    missing_skills: list[str] = Field(default_factory=list)


class RankedFreelancer(BaseModel):
    candidate: FreelancerCandidate
    match_score: float = Field(ge=0.0, le=100.0)
    rank_score: float = Field(ge=0.0, le=1.0)
    f_score: float = Field(ge=0.0)
    rank: int = Field(ge=1)
    breakdown: ScoreBreakdown

    def to_api_dict(self) -> dict[str, Any]:
        data = self.candidate.model_dump()
        data.update(
            {
                "match_score": self.match_score,
                "rank_score": self.rank_score,
                "fScore": round(self.f_score, 6),
                "rank": self.rank,
                "score_breakdown": self.breakdown.model_dump(),
            }
        )
        data.update(self.candidate.extra)
        return data


class RankingResult(BaseModel):
    ranked: list[RankedFreelancer]
    total_candidates: int


# --- CSP ---


class TeamBuilderConstraints(BaseModel):
    budget: float = Field(gt=0)
    required_skills: list[str] = Field(min_length=1)
    team_size: int = Field(ge=1, le=20)
    hours_per_member: int = Field(default=40, ge=1)
    max_fraud_score: float = Field(default=0.6, ge=0.0, le=1.0)


class TeamBuilderStats(BaseModel):
    backtracks: int = 0
    nodes_explored: int = 0
    forward_prunes: int = 0


class TeamBuilderResult(BaseModel):
    solved: bool
    team: list[FreelancerCandidate] = Field(default_factory=list)
    total_cost: float = 0.0
    message: str = ""
    stats: TeamBuilderStats = Field(default_factory=TeamBuilderStats)
    uncovered_skills: list[str] = Field(default_factory=list)

    def team_as_dicts(self) -> list[dict[str, Any]]:
        return [m.model_dump() for m in self.team]


# --- Bayesian fraud ---


class FraudSignalContribution(BaseModel):
    signal_id: str
    label: str
    active: bool
    likelihood_ratio: float
    log_likelihood_ratio: float


class FraudAssessment(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    confidence: ConfidenceLevel
    is_flagged: bool
    prior_log_odds: float
    posterior_log_odds: float
    signals: list[str]
    risk_factors: list[str]
    contributions: list[FraudSignalContribution]


# --- Explainer ---


class StructuredExplanation(BaseModel):
    summary: str
    bullets: list[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    source: Literal["claude", "deterministic"] = "deterministic"
    usage: dict[str, Any] | None = None

    @property
    def model_name(self) -> str:
        return (self.usage or {}).get("model", "deterministic")

    @property
    def text(self) -> str:
        if not self.bullets:
            return self.summary
        body = "\n".join(f"- {b}" for b in self.bullets)
        return f"{self.summary}\n\n{body}"


class SearchExplanationInput(BaseModel):
    query: str
    required_skills: list[str]
    budget: float
    team_size: int
    top_matches: list[RankedFreelancer]


class FraudExplanationInput(BaseModel):
    profile_name: str
    assessment: FraudAssessment


class TeamExplanationInput(BaseModel):
    constraints: TeamBuilderConstraints
    result: TeamBuilderResult
