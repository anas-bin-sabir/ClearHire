# Hosted database: Supabase Postgres

ClearHire uses Supabase **only as hosted Postgres**. Auth stays in the app (NextAuth on the frontend, JWTs issued by FastAPI) and every query goes through FastAPI. The browser never talks to Supabase, and the Supabase API keys aren't used.

Local development and tests keep using Docker (`docker compose up -d`, port 5435).

## Why it works

- **pgvector** is available. Migration `0001` runs `CREATE EXTENSION IF NOT EXISTS vector`, which Supabase allows for the `postgres` role. HNSW indexes work as they do locally.
- **Full-text search** (`tsvector`, GIN, the `skills_to_text` function from `0003`) is plain Postgres.
- **Alembic** runs unchanged against the pooler URL. The schema is built by `alembic upgrade head`, never by the Supabase dashboard.
- Search sets `hnsw.iterative_scan`, which needs **pgvector ≥ 0.8**. The API logs a warning at startup if the version is older.

## 1. Create the project

1. In Supabase, create a project in the region closest to the API host (for example the same AWS region as your Render service). Every query crosses that link.
2. Save the database password. Prefer letters and digits so it doesn't need URL-encoding.

## 2. Pick the connection string

Find it under **Connect** (or Project Settings → Database).

| Option | Host:port | Use it? |
|---|---|---|
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` | **Yes.** IPv4, one server connection per client connection, and prepared statements and session settings behave normally. |
| Direct connection | `db.<ref>.supabase.co:5432` | Only from IPv6-capable hosts. It's IPv6-only unless you buy the IPv4 add-on, and Render and most laptops can't reach it. |
| Transaction pooler | `aws-0-<region>.pooler.supabase.com:6543` | Avoid. asyncpg's prepared statements break, so the app sets `DB_STATEMENT_CACHE_SIZE=0` automatically on 6543. Session settings don't persist between transactions either. Search's `SET LOCAL hnsw.*` still works because it's transaction-local, but anything session-scoped won't. |

For the app, add the asyncpg driver:

```
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

URL-encode special characters in the password: `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `?` → `%3F`, `%` → `%25`. Don't append `?sslmode=...`, because asyncpg rejects it. TLS is handled by `DB_SSL_MODE`.

## 3. Database settings

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local Docker | The session pooler URL above |
| `DB_SSL_MODE` | empty = auto | Auto means `require` for `*.supabase.co`/`*.supabase.com` hosts and disabled otherwise. Also accepts `require`, `verify-full`, `disable` |
| `DB_POOL_SIZE` | 5 | Connections per API process |
| `DB_MAX_OVERFLOW` | 5 | Burst connections per process; size + overflow is the per-process ceiling |
| `DB_STATEMENT_CACHE_SIZE` | unset | Auto `0` on port 6543; leave unset on 5432 |

Keep `(DB_POOL_SIZE + DB_MAX_OVERFLOW) × processes` well under the pooler's client limit for your plan. The free tier is small, so the defaults suit a single Render instance.

## 4. Schema and data

Run this from the repo with Docker's database running. The script takes the **plain** `postgresql://` form of the same URL:

```bash
export TARGET_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'

# A: copy your local data (default SOURCE_URL = docker compose DB on :5435)
backend/scripts/migrate_to_supabase.sh

# B: or start fresh with demo data
backend/scripts/migrate_to_supabase.sh --reseed        # SEED_COUNT=50 by default
```

Both modes run `alembic upgrade head` on the target first and report the pgvector version.

Copy mode:

1. Dumps data only from `public`, excluding `alembic_version`.
2. Loads it in a single transaction with `session_replication_role = replica`. `pg_restore --disable-triggers` needs superuser, which Supabase doesn't grant.
3. Resets every serial/identity sequence.
4. Prints per-table row counts for source and target, and exits non-zero on a mismatch.

It refuses to load into tables that already contain rows. If the API already started against Supabase and created rows, rerun with `TRUNCATE_TARGET=1`. Requirements: `psql`, `pg_dump` and `pg_restore` with a `pg_dump` major version ≥ the source server's (16 for the compose image), plus the backend Python environment (`backend/.venv` is picked up automatically, otherwise set `PYTHON=`).

To migrate the schema manually instead: `cd backend && DATABASE_URL='postgresql+asyncpg://…' alembic upgrade head`.

## 5. Verify

```sql
select extversion from pg_extension where extname = 'vector';   -- expect >= 0.8
select count(*) from freelancers;                                -- matches source / seed
select relname, relrowsecurity from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'; -- all true after 0004
```

Then, against the deployed API:

```bash
curl -s https://<api>/health
curl -s -X POST https://<api>/search -H 'content-type: application/json' \
  -d '{"query": "react developer"}'
```

Expect `"postgres": "ok"` from `/health` and non-empty results from `/search`.

## Security

- Migration `0004_supabase_rls` enables RLS on every public table and adds no policies. It also revokes the `anon` and `authenticated` grants. Supabase's auto-generated Data API (PostgREST) therefore exposes nothing, even to someone holding the project's anon key. The app connects as `postgres` (the table owner), so RLS doesn't affect it. After schema changes, check that new tables are covered (the Supabase Security Advisor flags tables without RLS).
- Don't put the `anon`/publishable or `service_role` keys into the app. They aren't needed, and `service_role` bypasses RLS.
- The database password is the only secret. Set it as a dashboard secret on Render, never in `render.yaml` or the repo.
- **Never point `TEST_DATABASE_URL` at Supabase.** The test suite drops and recreates the public schema. Tests run only against the disposable local container (port 5436).
- Set `SEED_ENABLED=false` on the hosted API once the demo data is loaded, so `POST /seed --reset` can't wipe it.

## Free-tier limits

- **500 MB** database. Each 384-d vector is about 1.5 KB plus its HNSW index, so thousands of profiles fit comfortably.
- **Pauses after 7 days without activity.** Restore it from the dashboard; the data is kept. For a demo that must stay up, schedule a `/health` ping or upgrade.
- **Connection limits** on the pooler. Keep the pool small (section 3) and run one API instance.

## Deployment settings

**Render** (`render.yaml` no longer creates a Render database):

- Set `DATABASE_URL` to the `postgresql+asyncpg://` session pooler URL. It's `sync: false`, so enter it in the dashboard.
- `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` default to 5 in the blueprint.
- `AUTO_MIGRATE=true` (default) applies migrations at startup. Set it to `false` if you run `alembic upgrade head` as a release step instead.
- Also set `CORS_ORIGINS` to the Vercel domain, `ANTHROPIC_API_KEY` (optional) and `SEED_ENABLED=false`.

**Vercel** doesn't need any database variable, because the frontend only talks to FastAPI. Set `NEXT_PUBLIC_API_URL` (the Render URL), `NEXTAUTH_URL` (the Vercel URL) and `NEXTAUTH_SECRET`.
