"""Keyword channel for hybrid search and weighted skill adjacency.

Revision ID: 0003_hybrid_search
Revises: 0002_skill_taxonomy
Create Date: 2026-10-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.models.orm import FREELANCER_SEARCH_VECTOR_SQL

revision: str = "0003_hybrid_search"
down_revision: Union[str, None] = "0002_skill_taxonomy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION skills_to_text(skills varchar[])
        RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
        AS $$ SELECT coalesce(array_to_string(skills, ' '), '') $$
        """
    )
    op.add_column(
        "freelancers",
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(FREELANCER_SEARCH_VECTOR_SQL, persisted=True),
            nullable=True,
        ),
    )
    op.create_index(
        "freelancers_search_vector_gin",
        "freelancers",
        ["search_vector"],
        unique=False,
        postgresql_using="gin",
    )
    op.add_column(
        "skill_relationships",
        sa.Column("weight", sa.Float(), server_default="0.5", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("skill_relationships", "weight")
    op.drop_index("freelancers_search_vector_gin", table_name="freelancers", postgresql_using="gin")
    op.drop_column("freelancers", "search_vector")
    op.execute("DROP FUNCTION IF EXISTS skills_to_text(varchar[])")
