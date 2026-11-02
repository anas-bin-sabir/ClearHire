# Deploying ClearHire: Supabase + Gemini + Render + Vercel

| Piece | Runs on | Notes |
|---|---|---|
| Database (data, pgvector embeddings, full-text search, skill and collaboration graph) | Supabase Postgres | Graph features use recursive CTEs in Postgres; Neo4j isn't used |
| Authentication (passwords, access and refresh tokens) | Supabase Auth | FastAPI verifies Supabase tokens and keeps roles in its own `users` table |
| Language model (extraction, rerank, explanations) | Gemini `gemini-3.5-flash-lite` | Free tier from Google AI Studio. Every AI feature has a deterministic fallback |
| Embeddings | Inside the API (MiniLM via ONNX) | No external service; the model is baked into the Render build |
| API | Render (FastAPI) | `render.yaml` blueprint |
| Frontend | Vercel (Next.js) | https://clearhire-talent.vercel.app |

The browser only talks to Next.js and FastAPI. FastAPI is the only thing that talks to Supabase, so every Supabase key stays on Render.

## How auth works

```
Login form → NextAuth (Vercel) → POST /auth/login (Render) → Supabase Auth password grant
                                                            ← access + refresh token
FastAPI request → verifies the Supabase token (JWKS) → users.auth_user_id → role
```

- **Signup** (`POST /auth/signup`) creates the account in Supabase Auth through the admin API (confirmed immediately, so no confirmation email and no email rate limit), then creates the app `users` row linked by `auth_user_id`. The role is stored in the app row and in the Supabase user's `app_metadata`.
- **Login** signs in with Supabase. Roles always come from the app row, never from token claims.
- **Tokens** expire after an hour (Supabase's default). NextAuth renews them through `POST /auth/refresh` before they run out, so users stay signed in for the 24-hour session.
- **Existing accounts** (seeded demo users, or anything created before the switch) still have a local password hash. On their first successful login the API creates their Supabase account with the same password and drops the local hash.
- **Users added in the Supabase dashboard** get an app user on first login: role from `app_metadata.role` (`client`, `freelancer` or `admin`, else `client`) and name from `user_metadata.name`.
- Tests and offline development use `AUTH_PROVIDER=local` (the app's own hashes and JWTs). `auto` picks Supabase whenever `SUPABASE_URL` is set.

---

## Step 1: Create the Supabase project

1. At https://supabase.com/dashboard, select **New project**.
2. Name it `clearhire`. Choose a region and **note it**: Render should run near it (step 4).
3. Set a database password made of letters and digits only, so it needs no URL-encoding. Save it.
4. Wait until the project shows as healthy.

## Step 2: Collect the values you'll need

Keep these somewhere private (a password manager). Never commit them or paste them into chat.

| Value | Where in the Supabase dashboard | Becomes |
|---|---|---|
| Project URL | **Project Settings → Data API** (`https://<ref>.supabase.co`) | `SUPABASE_URL` |
| Publishable key (`sb_publishable_...`) or legacy `anon` key | **Project Settings → API Keys** | `SUPABASE_ANON_KEY` |
| Secret key (`sb_secret_...`) or legacy `service_role` key | **Project Settings → API Keys** (create one if none is listed) | `SUPABASE_SERVICE_ROLE_KEY` |
| Session pooler connection string | **Connect** button (top bar) → **Session pooler** | `DATABASE_URL` (see below) |
| JWT secret, *only if* the project still uses the legacy JWT secret | **Project Settings → JWT Keys** | `SUPABASE_JWT_SECRET` |

New projects sign tokens with asymmetric signing keys, which the API checks through the public JWKS endpoint, so `SUPABASE_JWT_SECRET` stays empty. Set it only if **JWT Keys** shows that the project still uses the legacy HS256 secret.

**`DATABASE_URL`.** Take the session pooler string, insert `+asyncpg` after `postgresql` and put your password in:

```
postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Use port **5432** (session pooler). The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from Render. The transaction pooler (6543) breaks asyncpg's prepared statements. Don't append `?sslmode=...`; TLS is turned on automatically for Supabase hosts.

## Step 3: Configure Supabase Auth

In **Authentication → Sign In / Providers**:

1. **Email** provider: enabled (it is by default).
2. **Allow new users to sign up**: turn it **off**. The API creates users with the secret key, which isn't affected. Turning it off stops anyone from registering straight against Supabase with the publishable key and skipping the app's signup rules.
3. **Confirm email**: either setting works. Accounts the API creates are already confirmed.

Optionally, under **Authentication → Policies → Password** (or **Attack Protection**), set the minimum password length to 8 to match the app's own rule.

## Step 4: Create the schema and demo data

Run this from your machine. It applies the Alembic migrations to Supabase (including RLS lockdown, see Security) and seeds demo data.

```bash
cd backend
# Point the local .env at Supabase for this one command, or export it:
export DATABASE_URL='postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
export EMBEDDING_PROVIDER=local
.venv/bin/python -m scripts.seed_database --count 50 --reset
```

Alternatively, to copy an existing local database instead of seeding, use `scripts/migrate_to_supabase.sh` (it takes the plain `postgresql://` form of the URL in `TARGET_URL`).

Demo logins afterwards: `admin@demo.com`, `client@demo.com` and `freelancer@demo.com`, all with password `demo1234`. Each moves into Supabase Auth on its first login.

## Step 5: Get a Gemini API key

1. Open https://aistudio.google.com/apikey and choose **Create API key**.
2. Keep it for `GEMINI_API_KEY`.

The blueprint uses `gemini-3.5-flash-lite`, Google's fastest current model. Check its free-tier rate limits in AI Studio (**Usage & limits** or the rate-limit page). When the limit is hit, the API falls back to its deterministic extraction and reasoning instead of failing.

## Step 6: Deploy the API on Render

1. Push this branch to GitHub and merge it into the branch Render should deploy (usually `main`).
2. Open `render.yaml` and set `region` to the one nearest your Supabase region (`frankfurt` for `eu-*`, `singapore` for `ap-south-1`/`ap-southeast-*`, `virginia` for `us-east-1`, `oregon` for `us-west-*`). Commit that change.
3. In Render: **New → Blueprint**, select the repository and apply `render.yaml`. It creates the `clearhire-api` web service on the free plan.
4. Render asks for each `sync: false` variable. Fill in:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `postgresql+asyncpg://` session pooler URL from step 2 |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable or anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | secret or service_role key |
| `SUPABASE_JWT_SECRET` | leave empty unless step 2 said otherwise |
| `GEMINI_API_KEY` | key from step 5 |

The blueprint already sets `AUTH_PROVIDER=supabase`, `LLM_PROVIDER=gemini`, `CORS_ORIGINS=https://clearhire-talent.vercel.app`, `SEED_ENABLED=false`, an empty `NEO4J_URI` and a generated `SECRET_KEY`.

5. Wait for the deploy to finish, then open `https://<service>.onrender.com/health`. Expect:

```json
{"status": "ok", "postgres": "ok", "neo4j": "disabled", "anthropic_configured": true,
 "llm_provider": "gemini", "auth_provider": "supabase"}
```

(`anthropic_configured` is a legacy field name that means "an LLM key is set".)

**Free-plan behaviour.** The service sleeps after 15 minutes without traffic, and the next request takes about a minute to wake it. The first login after a quiet period can be slow. Upgrade the plan, or ping `/health` on a schedule, if that matters for a demo.

## Step 7: Point Vercel at the API

In Vercel, open the `clear-hire` project, then **Settings → Environment Variables**, and set these for **Production** (and Preview if you use it):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<service>.onrender.com`, with no trailing slash |
| `NEXTAUTH_URL` | `https://clearhire-talent.vercel.app` |
| `NEXTAUTH_SECRET` | a random string: `openssl rand -base64 32` |

No Supabase variables are needed on Vercel. Then **Deployments → Redeploy** the latest production deployment. `NEXT_PUBLIC_*` values are compiled into the build, so changing them without a redeploy has no effect.

If Vercel deploys from `main`, merge this branch first so the token-refresh changes in `frontend/lib/auth.ts` ship with it.

## Step 8: Check everything end to end

1. Open https://clearhire-talent.vercel.app/login and sign in as `client@demo.com` / `demo1234`. In Supabase, **Authentication → Users** should now list that user.
2. As the client, create a project from a written description, which exercises Gemini extraction. Then run a search and build a team.
3. Sign up a new freelancer account and confirm it appears in Supabase **Authentication → Users** with `app_metadata.role = "freelancer"`.
4. Sign in as `admin@demo.com` and open the fraud, graph and analytics pages.
5. If a page fails, open the browser devtools **Network** tab:
   - **CORS error**: `CORS_ORIGINS` on Render must exactly match the Vercel URL.
   - **401 on every call**: check `SUPABASE_URL` on Render (the token issuer must match), and `SUPABASE_JWT_SECRET` if the project uses the legacy secret.
   - **503 on login**: Render can't reach Supabase Auth. Check `SUPABASE_URL` and the keys.

---

## Reference

### Database settings

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local Docker | The session pooler URL |
| `DB_SSL_MODE` | empty = auto | Auto means `require` for `*.supabase.co`/`*.supabase.com` hosts. Also accepts `require`, `verify-full`, `disable` |
| `DB_POOL_SIZE` | 5 | Connections per API process |
| `DB_MAX_OVERFLOW` | 5 | Burst connections per process; size + overflow is the per-process ceiling |
| `DB_STATEMENT_CACHE_SIZE` | unset | Auto `0` on port 6543; leave unset on 5432 |

Keep `(DB_POOL_SIZE + DB_MAX_OVERFLOW) × processes` well under the pooler's client limit. The defaults suit one free Render instance.

### Auth settings

| Variable | Default | Notes |
|---|---|---|
| `AUTH_PROVIDER` | `auto` | `supabase`, `local`, or `auto` (Supabase when `SUPABASE_URL` is set) |
| `SUPABASE_URL` | empty | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | empty | Publishable/anon key, used for sign-in and refresh |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Secret/service_role key, used only to create users. Server-only |
| `SUPABASE_JWT_SECRET` | empty | Legacy HS256 projects only |

### What Postgres provides

- **pgvector**: migration `0001` runs `CREATE EXTENSION IF NOT EXISTS vector`, which Supabase allows. Search sets `hnsw.iterative_scan`, which needs pgvector ≥ 0.8; the API logs a warning at startup if it's older.
- **Full-text search**: `tsvector`, GIN and `skills_to_text` (migration `0003`).
- **Graph features**: skill expansion and candidate subgraphs run as recursive CTEs over `skill_relationships` and `contracts` (the same results as the Neo4j backend; parity tests in `tests/test_graph_context.py`).
- **Schema**: built only by `alembic upgrade head` (applied at startup with `AUTO_MIGRATE=true`), never from the Supabase dashboard.

## Security

- Migration `0004_supabase_rls` enables RLS on every public table with no policies and revokes the `anon` and `authenticated` grants. Supabase's auto-generated Data API therefore exposes no app data, even to someone holding the publishable key. The API connects as `postgres` (the table owner), so RLS doesn't affect it. After schema changes, check that new tables are covered (the Supabase Security Advisor flags tables without RLS).
- The secret/service_role key bypasses RLS and can manage users. It lives only in Render's environment, never in the frontend, `render.yaml` or the repo.
- Roles are read from the app's `users` table. `app_metadata.role` only seeds a new app user, and only the secret key can write `app_metadata`.
- **Never point `TEST_DATABASE_URL` at Supabase.** The test suite drops and recreates the public schema. Tests run only against the disposable local container (port 5436).
- Keep `SEED_ENABLED=false` on the hosted API so `POST /seed --reset` can't wipe data.

## Free-tier limits

- **500 MB database.** Each 384-d vector is about 1.5 KB plus its HNSW index, so thousands of profiles fit.
- **The project pauses after 7 days without activity.** Restore it from the dashboard; data is kept.
- **Auth**: 50,000 monthly active users on the free plan.
- **Pooler connections are limited.** Keep the pool small and run one API instance.
