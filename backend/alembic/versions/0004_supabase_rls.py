"""Lock app tables away from Supabase's auto-exposed Data API.

Enables Row Level Security with no policies on every table this app owns, so the
``anon`` / ``authenticated`` roles used by PostgREST see nothing. The backend connects
as the table owner, which bypasses RLS because FORCE ROW LEVEL SECURITY is NOT set.
On plain Postgres (local Docker, CI) this is harmless and the role grants are skipped.

New tables added by later migrations must enable RLS themselves.

Revision ID: 0004_supabase_rls
Revises: 0003_hybrid_search
Create Date: 2026-10-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004_supabase_rls"
down_revision: Union[str, None] = "0003_hybrid_search"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every table created by 0001-0003 (matches app/models/orm.py) plus Alembic's own.
# Frozen here on purpose: a migration must not change meaning when the ORM evolves.
TABLES = (
    "users",
    "freelancers",
    "projects",
    "contracts",
    "skills",
    "skill_relationships",
    "activity_logs",
    "ai_explanations",
    "user_settings",
    "alembic_version",
)

SUPABASE_API_ROLES = ("anon", "authenticated")


def _revoke_api_role_sql(role: str) -> str:
    # Supabase creates these roles; plain Postgres does not, so skip silently there.
    return f"""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
            REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role};
            REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role};
            -- Objects the migrating role creates later are not auto-granted to it either.
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {role};
        END IF;
    END
    $$;
    """


def upgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE IF EXISTS public."{table}" ENABLE ROW LEVEL SECURITY')
    for role in SUPABASE_API_ROLES:
        op.execute(_revoke_api_role_sql(role))


def downgrade() -> None:
    # Grants are not restored: re-granting the Data API roles is a deliberate choice.
    for table in TABLES:
        op.execute(f'ALTER TABLE IF EXISTS public."{table}" DISABLE ROW LEVEL SECURITY')
