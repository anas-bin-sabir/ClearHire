"""Skill taxonomy table, richer project requirements, canonical skill names.

Revision ID: 0002_skill_taxonomy
Revises: 0001_baseline
Create Date: 2026-10-21
"""
from typing import Sequence, Union

from alembic import op
import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.ai.skill_taxonomy import canonicalize_all

revision: str = "0002_skill_taxonomy"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIMENSIONS = 384


def _canonicalize_column(table: str, column: str) -> None:
    """Rewrite skill arrays to canonical taxonomy names (e.g. "ML" -> "Machine Learning")."""
    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id, {column} FROM {table}")).all()
    for row_id, skills in rows:
        canonical = canonicalize_all(skills)
        if canonical != list(skills or []):
            conn.execute(
                sa.text(f"UPDATE {table} SET {column} = :skills WHERE id = :id"),
                {"skills": canonical, "id": row_id},
            )


def upgrade() -> None:
    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column(
            "aliases", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False
        ),
        sa.Column(
            "embedding",
            pgvector.sqlalchemy.Vector(dim=EMBEDDING_DIMENSIONS),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.add_column(
        "projects",
        sa.Column(
            "nice_to_have_skills",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("budget_type", sa.String(length=10), server_default="fixed", nullable=False),
    )
    op.add_column("projects", sa.Column("domain", sa.String(length=100), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "compliance", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False
        ),
    )
    _canonicalize_column("freelancers", "skills")
    _canonicalize_column("projects", "required_skills")


def downgrade() -> None:
    op.drop_column("projects", "compliance")
    op.drop_column("projects", "domain")
    op.drop_column("projects", "budget_type")
    op.drop_column("projects", "nice_to_have_skills")
    op.drop_table("skills")
