# ClearHire Backend (FastAPI)

## Database architecture

| Store | Layer | Purpose |
|-------|--------|---------|
| PostgreSQL + pgvector | `app/db/repositories/postgres/` | Users, freelancers, projects, contracts, skill relationships, embeddings |
| MongoDB (Motor) | `app/db/repositories/mongo/` | `activity_logs`, `search_history`, `ai_explanations`, `freelancer_meta` |
| Neo4j | `app/db/repositories/neo4j/` | Freelancer, Skill, Project nodes; HAS_SKILL, WORKED_ON, RELATED_TO, REFERRED_BY |

Routers call repositories only — no raw SQL in route handlers.

## Quick start

```bash
docker compose up -d
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Seed data

```bash
# CLI (Postgres + Mongo meta + Neo4j when available)
python -m scripts.seed_database --count 50 --reset

# Or via API
curl -X POST http://localhost:8000/seed -H "Content-Type: application/json" -d "{\"freelancer_count\": 50, \"reset\": true}"
```

## API endpoints (frontend integration)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Postgres, MongoDB, Neo4j, Claude key status |
| GET | `/stats` | Dashboard counts |
| GET | `/freelancers?q=&flagged_only=` | Fraud lab search, data manager |
| GET | `/freelancers/{id}` | Profile page |
| GET | `/projects` | Projects workspace |
| POST | `/search` | A* ranked freelancers + Claude explanation |
| POST | `/fraud` | Bayesian score + Claude explanation |
| POST | `/team-builder` | CSP team + Claude explanation |
| GET | `/graph` | Neo4j/Postgres skill graph (with fraud scores) |
| POST | `/seed` | Populate all databases |

## CORS

Set `CORS_ORIGINS` and optional `CORS_ORIGIN_REGEX` in `.env` so the Next.js app origin is allowed (default includes `localhost:3000` and LAN IPs).

## Claude explanations

Set `ANTHROPIC_API_KEY` in `backend/.env`. Without it, deterministic fallbacks are used (`source: deterministic` in Mongo `ai_explanations`). With a valid key, responses use Claude at `temperature=0` (`source: claude`).

## Repository map

- `UserRepository` — upsert/get users
- `FreelancerRepository` — CRUD, search filters, ranking dicts
- `ProjectRepository` — projects with embeddings
- `ContractRepository` — freelancer↔project contracts
- `SkillRelationshipRepository` — Postgres skill graph edges
- `ActivityLogRepository` — API activity in MongoDB
- `SearchHistoryRepository` — search audit trail
- `AIExplanationRepository` — stored LLM explanations
- `FreelancerMetaRepository` — tags, links, verification metadata
- `GraphRepository` — Neo4j schema, sync, graph queries
