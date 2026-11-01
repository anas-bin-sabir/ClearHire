# ClearHire — AI Talent Matching, Team Formation & Trust

ClearHire turns a client's natural-language project brief into structured constraints, retrieves and ranks freelancers with semantic search, assembles budget-feasible teams with a constraint solver, and scores profiles for fraud risk, explaining every recommendation.

- **Product requirements:** [`docs/PRD.md`](docs/PRD.md)
- **Current state & phased roadmap:** [`docs/CURRENT.md`](docs/CURRENT.md)

## Architecture

```
Next.js (NextAuth) ──JWT──► FastAPI ──► PostgreSQL + pgvector   (source of truth, HNSW ANN)
                                   └──► Claude API             (optional; deterministic fallbacks)
```

| Layer | Where | Notes |
|---|---|---|
| Frontend | `frontend/` | Next.js App Router; client, freelancer and admin workspaces |
| API | `backend/app/routers/` | Thin routers → repositories; no SQL in handlers |
| Data | `backend/app/db/` | SQLAlchemy async + Alembic migrations (`backend/alembic/`) |
| AI | `backend/app/ai/` | `embeddings`, `ranking`, `team_solver` (CSP), `fraud` (Bayesian), `explainer`, `project_parser` |

**Posting a project:** the client describes it in plain language → `POST /projects/extract` (Claude structured outputs, or a rule-based parser without a key) → skills grounded to a canonical taxonomy → the client reviews and edits → `POST /projects`.

**Matching pipeline:** hard filters + pgvector cosine ANN in SQL → deterministic weighted ranking (semantic, skills, budget, experience, rating, availability, trust) → explanation (Claude, or deterministic when no key).

Neo4j GraphRAG is planned as an optional derived graph store (Phase 4 in `docs/CURRENT.md`). Today the admin graph view is served from PostgreSQL.

## Quick start

Prerequisites: Docker (or Podman), Python 3.11+, Node.js 20+.

```bash
# 1. Database (PostgreSQL 16 + pgvector on localhost:5435)
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # adjust if needed
python -m scripts.seed_database --count 50 --reset   # migrates + seeds demo data
uvicorn app.main:app --reload --port 8000            # docs at http://localhost:8000/docs

# 3. Frontend
cd ../frontend
npm install
cat > .env.local <<'ENV'
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
ENV
npm run dev                                          # http://localhost:3000
```

The schema is managed by Alembic and applied automatically on startup (`AUTO_MIGRATE=true`). To run it manually: `cd backend && alembic upgrade head`.

## Hosted database (Supabase)

In production the API uses Supabase as plain hosted Postgres (pgvector included). Auth stays in the app and only FastAPI talks to the database. Set `DATABASE_URL` to the session pooler URL (`postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`), then move local data with `backend/scripts/migrate_to_supabase.sh` or reseed with `--reseed`. The full runbook, covering connection options, security and free-tier limits, is in [`docs/SUPABASE.md`](docs/SUPABASE.md). Tests always run on the local Docker database.

## Demo accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `demo` |
| Client | `client@demo.com` | `demo` |
| Freelancer | `freelancer@demo.com` | `demo` |

Self-signup is limited to the client and freelancer roles. Admins come from the seeder.

## Tests

```bash
# Disposable pgvector database for the test suite (port 5436)
docker run -d --name clearhire-test-db -p 5436:5432 \
  -e POSTGRES_USER=clearhire -e POSTGRES_PASSWORD=clearhire123 -e POSTGRES_DB=clearhire_test \
  pgvector/pgvector:pg16

cd backend
pip install -r requirements-dev.txt
pytest -q
```

Tests use `EMBEDDING_PROVIDER=hash` (no model download) and never call the LLM; the Claude client is exercised against a stubbed SDK.

Requirement-extraction quality is scored on labelled briefs:

```bash
python -m scripts.eval_extraction --set holdout          # rule-based fallback, offline
python -m scripts.eval_extraction --set holdout --llm    # Claude (needs ANTHROPIC_API_KEY)
```

Override the test database with `TEST_DATABASE_URL`. CI (`.github/workflows/ci.yml`) runs the backend tests plus frontend lint and build.
