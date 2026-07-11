"""Baseline schema: PostgreSQL + pgvector (replaces create_all at startup).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-20
"""
from typing import Sequence, Union

from alembic import op
import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIMENSIONS = 384


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "freelancers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False),
        sa.Column("hourly_rate", sa.Float(), nullable=False),
        sa.Column("experience_years", sa.Integer(), nullable=False),
        sa.Column("account_age_days", sa.Integer(), nullable=False),
        sa.Column("fraud_score", sa.Float(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("availability", sa.Boolean(), nullable=False),
        sa.Column("review_count", sa.Integer(), nullable=False),
        sa.Column("portfolio_urls", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column(
            "embedding",
            pgvector.sqlalchemy.Vector(dim=EMBEDDING_DIMENSIONS),
            nullable=True,
        ),
        sa.Column("referred_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["referred_by_id"], ["freelancers.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("required_skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("budget", sa.Float(), nullable=False),
        sa.Column("deadline_days", sa.Integer(), nullable=False),
        sa.Column("team_size", sa.Integer(), nullable=False),
        sa.Column("seniority_level", sa.String(length=20), nullable=False),
        sa.Column(
            "implicit_constraints", postgresql.ARRAY(sa.String()), nullable=False
        ),
        sa.Column(
            "embedding",
            pgvector.sqlalchemy.Vector(dim=EMBEDDING_DIMENSIONS),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "contracts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("freelancer_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["freelancer_id"], ["freelancers.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("freelancer_id", "project_id", name="uq_contract_pair"),
    )
    op.create_table(
        "skill_relationships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("skill_a", sa.String(length=100), nullable=False),
        sa.Column("skill_b", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("skill_a", "skill_b", name="uq_skill_pair"),
    )
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "response_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ai_explanations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("pipeline", sa.String(length=50), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("user_prompt", sa.Text(), nullable=False),
        sa.Column(
            "metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ran_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )

    for table in ("freelancers", "projects"):
        op.create_index(
            f"{table}_embedding_hnsw",
            table,
            ["embedding"],
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        )


def downgrade() -> None:
    op.drop_index("projects_embedding_hnsw", table_name="projects")
    op.drop_index("freelancers_embedding_hnsw", table_name="freelancers")
    op.drop_table("user_settings")
    op.drop_table("ai_explanations")
    op.drop_table("activity_logs")
    op.drop_table("skill_relationships")
    op.drop_table("contracts")
    op.drop_table("projects")
    op.drop_table("freelancers")
    op.drop_table("users")
