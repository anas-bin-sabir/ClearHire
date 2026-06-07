from datetime import datetime, timezone
from enum import Enum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.config import settings


class Base(DeclarativeBase):
    pass


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


class SkillRelationship(Base):
    __tablename__ = "skill_relationships"
    __table_args__ = (UniqueConstraint("skill_a", "skill_b", name="uq_skill_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    skill_a: Mapped[str] = mapped_column(String(100), nullable=False)
    skill_b: Mapped[str] = mapped_column(String(100), nullable=False)
