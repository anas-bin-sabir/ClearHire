"""Outbox table for the Postgres -> Neo4j graph sync.

Entity changes append rows here in the same transaction (app.graph.outbox); a
background task drains them into Neo4j (app.graph.sync). RLS is enabled like every
other app table (see 0004_supabase_rls).

Revision ID: 0005_graph_outbox
Revises: 0004_supabase_rls
Create Date: 2026-10-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_graph_outbox"
down_revision: Union[str, None] = "0004_supabase_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "graph_outbox",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("op", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_graph_outbox_pending",
        "graph_outbox",
        ["id"],
        unique=False,
        postgresql_where=sa.text("processed_at IS NULL"),
    )
    op.execute('ALTER TABLE public."graph_outbox" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_index(
        "ix_graph_outbox_pending",
        table_name="graph_outbox",
        postgresql_where=sa.text("processed_at IS NULL"),
    )
    op.drop_table("graph_outbox")
