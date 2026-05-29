from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --- Search ---


class SearchRequest(BaseModel):
    query: str = Field(default="", description="Natural language search criteria")
    skills: list[str] = Field(default_factory=list)
    min_rate: Optional[float] = Field(default=None, alias="minRate")
    max_rate: Optional[float] = Field(default=None, alias="maxRate")
    min_rating: Optional[float] = Field(default=None, alias="minRating")
    available_only: bool = Field(default=False, alias="availableOnly")
    max_fraud: float = Field(default=1.0, ge=0.0, le=1.0, alias="maxFraud")
    budget: float = Field(default=10000.0)
    team_size: int = Field(default=1, ge=1)

    model_config = {"populate_by_name": True}


class RankedFreelancer(BaseModel):
    id: int
    name: str
    skills: list[str]
    rating: float
    hourly_rate: float
    experience_years: int
    account_age_days: int
    fraud_score: float
    bio: Optional[str] = None
    location: Optional[str] = None
    availability: bool = True
    match_score: float
    rank_score: float
    f_score: float = Field(alias="fScore")

    model_config = {"populate_by_name": True}


class SearchResponse(BaseModel):
    freelancers: list[dict[str, Any]]
    explanation: str
    total_candidates: int


# --- Fraud ---


class FraudRequest(BaseModel):
    freelancer_id: Optional[int] = None
    name: Optional[str] = None
    account_age_days: Optional[int] = None
    rating: Optional[float] = None
    hourly_rate: Optional[float] = None
    experience_years: Optional[int] = None
    review_count: Optional[int] = None
    portfolio_urls: Optional[list[str]] = None
    skills: Optional[list[str]] = None


class FraudResponse(BaseModel):
    score: float
    confidence: Literal["low", "medium", "high"]
    signals: list[str]
    risk_factors: list[str]
    is_flagged: bool
    freelancer: Optional[dict[str, Any]] = None
    explanation: str


# --- Team builder ---


class TeamBuilderRequest(BaseModel):
    budget: float = Field(gt=0)
    required_skills: list[str] = Field(min_length=1)
    team_size: int = Field(ge=1, le=20)
    hours_per_member: int = Field(default=40, ge=1)
    max_fraud_score: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Maximum allowed fraud_score for candidates",
    )


class TeamBuilderResponse(BaseModel):
    success: bool
    team: list[dict[str, Any]]
    total_cost: float
    explanation: str
    message: Optional[str] = None
    backtracks: int = 0
    nodes_explored: int = 0


# --- Graph ---


class GraphNode(BaseModel):
    id: str
    name: str
    type: Literal["freelancer", "skill", "project"]
    fraud_score: Optional[float] = Field(
        default=None,
        description="Bayesian fraud score for freelancer nodes",
    )


class GraphLink(BaseModel):
    source: str
    target: str
    type: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]
    source: str = Field(description="primary data source: postgres or neo4j")


# --- Seed ---


class SeedRequest(BaseModel):
    freelancer_count: int = Field(default=50, ge=1, le=500)
    reset: bool = Field(
        default=False,
        description="If true, clears freelancers/projects before seeding",
    )


class SeedResponse(BaseModel):
    success: bool
    message: str
    freelancers_created: int
    projects_created: int
    contracts_created: int = 0
    neo4j_synced: bool = False


# --- Freelancers / projects / stats ---


class FreelancerRecord(BaseModel):
    id: int
    name: str
    skills: list[str] = Field(default_factory=list)
    rating: float = 0.0
    hourly_rate: float = 0.0
    experience_years: int = 0
    account_age_days: int = 0
    fraud_score: float = 0.0
    bio: Optional[str] = None
    location: Optional[str] = None
    availability: bool = True
    review_count: int = 0
    portfolio_urls: list[str] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class FreelancerListResponse(BaseModel):
    freelancers: list[dict[str, Any]]
    total: int


class ProjectRecord(BaseModel):
    id: int
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    budget: float = 0.0
    deadline_days: int = 30
    team_size: int = 1
    status: str = "open"
    team_members: list[int] = Field(default_factory=list)
    client: Optional[str] = None
    created: Optional[str] = None
    priority: str = "medium"

    model_config = {"extra": "allow"}


class ProjectListResponse(BaseModel):
    projects: list[ProjectRecord]
    total: int


class PlatformStatsResponse(BaseModel):
    freelancers_total: int
    open_projects: int
    fraud_flagged: int
    teams_built: int
    projects_total: int = 0


class HealthResponse(BaseModel):
    status: str
    postgres: str
    mongodb: str
    neo4j: str
    anthropic_configured: bool
