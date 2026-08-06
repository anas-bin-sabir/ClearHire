import re
from typing import Any, Literal, Optional

from pydantic import AnyUrl, BaseModel, Field, field_validator

# --- Shared validation primitives ---
#
# These schemas reject malformed input outright (HTTP 422) rather than
# silently sanitizing/escaping it. Every request model below is
# `extra="forbid"`: unrecognized fields fail validation instead of being
# dropped.

NAME_PATTERN = re.compile(r"^[A-Za-z0-9À-ÿ .,'\-]{1,255}$")
SKILL_PATTERN = re.compile(r"^[A-Za-z0-9+#. \-]{1,50}$")
MAX_LIST_ITEMS = 50


def _validate_name(value: str) -> str:
    value = value.strip()
    if not NAME_PATTERN.match(value):
        raise ValueError(
            "must be 1-255 characters using letters, numbers, spaces, and . , ' - only"
        )
    return value


def _validate_skills(skills: list[str]) -> list[str]:
    if len(skills) > MAX_LIST_ITEMS:
        raise ValueError(f"at most {MAX_LIST_ITEMS} skills allowed")
    cleaned = []
    for skill in skills:
        skill = skill.strip()
        if not SKILL_PATTERN.match(skill):
            raise ValueError(
                f"invalid skill {skill!r}: must be 1-50 chars of letters, numbers, "
                "spaces, + # . -"
            )
        cleaned.append(skill)
    return cleaned


def _validate_urls(urls: list[str]) -> list[str]:
    if len(urls) > MAX_LIST_ITEMS:
        raise ValueError(f"at most {MAX_LIST_ITEMS} URLs allowed")
    validated = []
    for url in urls:
        parsed = AnyUrl(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"invalid URL {url!r}: only http/https allowed")
        validated.append(str(parsed))
    return validated


# --- Search ---


class SearchRequest(BaseModel):
    query: str = Field(default="", max_length=500, description="Natural language search criteria")
    skills: list[str] = Field(default_factory=list)
    min_rate: Optional[float] = Field(default=None, ge=0, le=100_000, alias="minRate")
    max_rate: Optional[float] = Field(default=None, ge=0, le=100_000, alias="maxRate")
    min_rating: Optional[float] = Field(default=None, ge=0, le=5, alias="minRating")
    available_only: bool = Field(default=False, alias="availableOnly")
    max_fraud: float = Field(default=1.0, ge=0.0, le=1.0, alias="maxFraud")
    budget: float = Field(default=10000.0, gt=0, le=100_000_000)
    team_size: int = Field(default=1, ge=1, le=50)

    model_config = {"populate_by_name": True, "extra": "forbid"}

    @field_validator("skills")
    @classmethod
    def _skills_valid(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)


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
    freelancer_id: Optional[int] = Field(default=None, gt=0)
    name: Optional[str] = Field(default=None, max_length=255)
    account_age_days: Optional[int] = Field(default=None, ge=0, le=36_500)
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    hourly_rate: Optional[float] = Field(default=None, ge=0, le=100_000)
    experience_years: Optional[int] = Field(default=None, ge=0, le=80)
    review_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    portfolio_urls: Optional[list[str]] = None
    skills: Optional[list[str]] = None

    model_config = {"extra": "forbid"}

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: Optional[str]) -> Optional[str]:
        return _validate_name(v) if v is not None else v

    @field_validator("skills")
    @classmethod
    def _skills_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_skills(v) if v is not None else v

    @field_validator("portfolio_urls")
    @classmethod
    def _urls_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_urls(v) if v is not None else v


class FraudResponse(BaseModel):
    score: float
    confidence: Literal["low", "medium", "high"]
    signals: list[str]
    risk_factors: list[str]
    is_flagged: bool
    freelancer: Optional[dict[str, Any]] = None
    explanation: str
    source: Optional[str] = None
    ran_at: Optional[str] = None
    note: Optional[str] = None


# --- Team builder ---


class TeamBuilderRequest(BaseModel):
    budget: float = Field(gt=0, le=100_000_000)
    required_skills: list[str] = Field(min_length=1, max_length=MAX_LIST_ITEMS)
    team_size: int = Field(ge=1, le=20)
    hours_per_member: int = Field(default=40, ge=1, le=200)
    max_fraud_score: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Maximum allowed fraud_score for candidates",
    )
    project_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional project to associate with background CSP agent run",
    )
    deadline_days: Optional[int] = Field(default=30, ge=1, le=3650)

    model_config = {"extra": "forbid"}

    @field_validator("required_skills")
    @classmethod
    def _skills_valid(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)


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

    model_config = {"extra": "forbid"}


class SeedResponse(BaseModel):
    success: bool
    message: str
    freelancers_created: int
    projects_created: int
    contracts_created: int = 0
    neo4j_synced: bool = False


# --- Freelancers / projects / stats ---

class FreelancerUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    skills: Optional[list[str]] = None
    hourly_rate: Optional[float] = Field(default=None, ge=0, le=100_000)
    experience_years: Optional[int] = Field(default=None, ge=0, le=80)
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    review_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    account_age_days: Optional[int] = Field(default=None, ge=0, le=36_500)
    availability: Optional[bool] = None
    portfolio_urls: Optional[list[str]] = None
    bio: Optional[str] = Field(default=None, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=255)

    model_config = {"extra": "forbid"}

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: Optional[str]) -> Optional[str]:
        return _validate_name(v) if v is not None else v

    @field_validator("skills")
    @classmethod
    def _skills_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_skills(v) if v is not None else v

    @field_validator("portfolio_urls")
    @classmethod
    def _urls_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_urls(v) if v is not None else v


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


class ProjectUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    required_skills: Optional[list[str]] = None
    budget: Optional[float] = Field(default=None, gt=0, le=100_000_000)
    deadline_days: Optional[int] = Field(default=None, ge=1, le=3650)
    team_size: Optional[int] = Field(default=None, ge=1, le=50)

    model_config = {"extra": "forbid"}

    @field_validator("required_skills")
    @classmethod
    def _skills_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_skills(v) if v is not None else v


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


# --- Analytics ---


class DayMetrics(BaseModel):
    label: str
    searches: int
    teams: int
    fraud: int


class TimeSeriesResponse(BaseModel):
    data: list[DayMetrics]
    total_searches: int
    total_teams: int
    total_fraud: int
    period: str = "weekly"


# --- Projects (create) ---


class ProjectCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    client: Optional[str] = Field(default=None, max_length=255)
    required_skills: list[str] = Field(default_factory=list)
    budget: float = Field(gt=0, le=100_000_000)
    deadline_days: int = Field(default=30, ge=1, le=365)
    team_size: int = Field(default=1, ge=1, le=50)

    model_config = {"extra": "forbid"}

    @field_validator("required_skills")
    @classmethod
    def _skills_valid(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)


class ProjectCreateResponse(BaseModel):
    project: ProjectRecord


# --- Contracts ---

CONTRACT_STATUS_PATTERN = r"^(pending|active|completed|cancelled)$"


class ContractRecord(BaseModel):
    id: int
    freelancer_id: int
    project_id: int
    status: str
    created_at: Optional[str] = None


class ContractListResponse(BaseModel):
    contracts: list[ContractRecord]
    total: int


class ContractCreateRequest(BaseModel):
    freelancer_id: int = Field(gt=0)
    project_id: int = Field(gt=0)
    status: str = Field(default="active", pattern=CONTRACT_STATUS_PATTERN)

    model_config = {"extra": "forbid"}


class ContractUpdateRequest(BaseModel):
    status: str = Field(pattern=CONTRACT_STATUS_PATTERN)

    model_config = {"extra": "forbid"}


class ContractBatchRequest(BaseModel):
    project_id: int = Field(gt=0)
    freelancer_ids: list[int] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    status: str = Field(default="active", pattern=CONTRACT_STATUS_PATTERN)

    model_config = {"extra": "forbid"}

    @field_validator("freelancer_ids")
    @classmethod
    def _ids_valid(cls, v: list[int]) -> list[int]:
        for fid in v:
            if fid <= 0:
                raise ValueError("freelancer_ids must be positive integers")
        return v


class ActivityFeedItem(BaseModel):
    id: str
    type: str
    text: str
    time: str


class ActivityFeedResponse(BaseModel):
    items: list[ActivityFeedItem]


class RecentSearchItem(BaseModel):
    query: str
    results: int
    time: str


class RecentSearchResponse(BaseModel):
    searches: list[RecentSearchItem]


class SkillListResponse(BaseModel):
    skills: list[str]


# --- Settings ---


class UserPreferences(BaseModel):
    """Also used to reconstruct preferences from stored documents, so it
    tolerates unknown/legacy fields on read. `UserPreferencesUpdate` is the
    strict variant used to validate incoming write requests."""

    notifications_enabled: bool = True
    email_alerts: bool = True
    fraud_sensitivity: float = Field(default=0.6, ge=0.0, le=1.0)
    preferred_skills: list[str] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    theme: Literal["dark", "light"] = "dark"

    @field_validator("preferred_skills")
    @classmethod
    def _skills_valid(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)


class UserPreferencesUpdate(UserPreferences):
    model_config = {"extra": "forbid"}


class UserSettingsResponse(BaseModel):
    user_id: int
    preferences: UserPreferences


class FreelancerCreateRequest(BaseModel):
    name: str = Field(max_length=255)
    skills: list[str] = Field(default_factory=list)
    hourly_rate: float = Field(default=0.0, ge=0, le=100_000)
    experience_years: int = Field(default=0, ge=0, le=80)
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    review_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    account_age_days: Optional[int] = Field(default=None, ge=0, le=36_500)
    availability: Optional[bool] = None
    portfolio_urls: Optional[list[str]] = None

    model_config = {"extra": "forbid"}

    @field_validator("name")
    @classmethod
    def _name_valid(cls, v: str) -> str:
        return _validate_name(v)

    @field_validator("skills")
    @classmethod
    def _skills_valid(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)

    @field_validator("portfolio_urls")
    @classmethod
    def _urls_valid(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_urls(v) if v is not None else v


class FreelancerCreateResponse(BaseModel):
    freelancer: dict
    message: str
