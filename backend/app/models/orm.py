from datetime import datetime, timezone
from enum import Enum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def hnsw_index(table: str) -> Index:
    """pgvector HNSW index for cosine-distance ANN search on ``embedding``."""
    return Index(
        f"{table}_embedding_hnsw",
        "embedding",
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


# Keyword channel for hybrid search: skills outweigh bio, bio outweighs name.
# skills_to_text() is an IMMUTABLE wrapper (migration 0003) because array_to_string
# itself is only STABLE and generated columns need immutable expressions.
FREELANCER_SEARCH_VECTOR_SQL = (
    "setweight(to_tsvector('english'::regconfig, skills_to_text(skills)), 'A') || "
    "setweight(to_tsvector('english'::regconfig, coalesce(bio, '')), 'B') || "
    "setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'C')"
)


class ContractStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="client")
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    freelancers: Mapped[list["Freelancer"]] = relationship(back_populates="user")
    projects: Mapped[list["Project"]] = relationship(
        back_populates="client",
        foreign_keys="Project.client_id",
    )


class Freelancer(Base):
    __tablename__ = "freelancers"
    __table_args__ = (
        hnsw_index("freelancers"),
        Index("freelancers_search_vector_gin", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    account_age_days: Mapped[int] = mapped_column(Integer, default=0)
    fraud_score: Mapped[float] = mapped_column(Float, default=0.0)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    availability: Mapped[bool] = mapped_column(Boolean, default=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    portfolio_urls: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dimensions),
        nullable=True,
    )
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR, Computed(FREELANCER_SEARCH_VECTOR_SQL, persisted=True), nullable=True
    )
    referred_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("freelancers.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User | None"] = relationship(back_populates="freelancers")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="freelancer")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (hnsw_index("projects"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    deadline_days: Mapped[int] = mapped_column(Integer, default=30)
    team_size: Mapped[int] = mapped_column(Integer, default=1)
    seniority_level: Mapped[str] = mapped_column(String(20), default="mid")
    implicit_constraints: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    nice_to_have_skills: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    budget_type: Mapped[str] = mapped_column(
        String(10), default="fixed", server_default="fixed"
    )
    domain: Mapped[str | None] = mapped_column(String(100), nullable=True)
    compliance: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dimensions),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    client: Mapped["User | None"] = relationship(
        back_populates="projects",
        foreign_keys=[client_id],
    )
    contracts: Mapped[list["Contract"]] = relationship(back_populates="project")


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        UniqueConstraint("freelancer_id", "project_id", name="uq_contract_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    freelancer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("freelancers.id"), nullable=False
    )
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default=ContractStatus.PENDING.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    freelancer: Mapped["Freelancer"] = relationship(back_populates="contracts")
    project: Mapped["Project"] = relationship(back_populates="contracts")


class Skill(Base):
    """Canonical skill taxonomy (mirrors app.ai.skill_taxonomy, plus embeddings)."""

    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dimensions),
        nullable=True,
    )


class SkillRelationship(Base):
    __tablename__ = "skill_relationships"
    __table_args__ = (UniqueConstraint("skill_a", "skill_b", name="uq_skill_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    skill_a: Mapped[str] = mapped_column(String(100), nullable=False)
    skill_b: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=0.5, server_default="0.5")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="success")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AIExplanation(Base):
    __tablename__ = "ai_explanations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pipeline: Mapped[str | None] = mapped_column(String(50), nullable=True)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="deterministic")
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    user_prompt: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    ran_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class UserSetting(Base):
    __tablename__ = "user_settings"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


from sqlalchemy import func as _sa_func, text as _sa_text  # noqa: E402  (graph outbox)


class GraphOutbox(Base):
    """Pending Postgres -> Neo4j sync work (see app.graph.outbox / app.graph.sync).

    Rows are written in the same transaction as the entity change and drained by a
    background task, so a Neo4j outage never fails the request that caused it.
    entity_type: freelancer | project | contract | user | skill_relationships
    op:          upsert | delete
    """

    __tablename__ = "graph_outbox"
    __table_args__ = (
        Index(
            "ix_graph_outbox_pending",
            "id",
            postgresql_where=_sa_text("processed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    op: Mapped[str] = mapped_column(String(10), nullable=False, default="upsert")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=_sa_func.now(),
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
