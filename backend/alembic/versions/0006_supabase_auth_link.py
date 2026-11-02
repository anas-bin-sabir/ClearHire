"""Link app users to Supabase Auth accounts.

``users.auth_user_id`` holds ``auth.users.id`` once Supabase Auth owns the account's
password. No foreign key to ``auth.users``: that schema only exists on Supabase, and
local/test databases must migrate too.

Revision ID: 0006_supabase_auth_link
Revises: 0005_graph_outbox
Create Date: 2026-11-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_supabase_auth_link"
down_revision: Union[str, None] = "0005_graph_outbox"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint("users_auth_user_id_key", "users", ["auth_user_id"])


def downgrade() -> None:
    op.drop_constraint("users_auth_user_id_key", "users", type_="unique")
    op.drop_column("users", "auth_user_id")
