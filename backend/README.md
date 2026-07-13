# ClearHire Backend (FastAPI)

See the [root README](../README.md) for setup. This file maps the code.

## Layout

| Path | Purpose |
|---|---|
| `app/main.py` | App factory, CORS, router mounting; migrations run in the lifespan |
| `app/routers/` | HTTP handlers. They call repositories only, never raw SQL |
| `app/db/repositories/postgres/` | One repository per aggregate (users, freelancers, projects, contracts, skills, activity/explanations/settings) |
| `app/db/migrate.py`, `alembic/` | Alembic migrations; databases from the pre-Alembic `create_all` era are stamped at the baseline |
| `app/ai/embeddings.py` | Profile/project embedding text + 384-d MiniLM vectors (`EMBEDDING_PROVIDER=hash` for tests) |
| `app/ai/ranking.py` | Deterministic weighted ranking with per-feature breakdown (weights in config) |
| `app/ai/team_solver.py` | Team CSP (`csp.py`) plus conflict diagnosis and relaxation hints |
| `app/ai/fraud.py` | Bayesian log-odds fraud scoring (`bayesian.py`) with new-account dampening |
| `app/ai/llm.py` | The only Claude client: structured outputs, typed errors → `LLMUnavailable`, usage metadata |
| `app/ai/skill_taxonomy.py` | Canonical skills + aliases; every stored skill name goes through `canonicalize` |
| `app/ai/project_parser.py` | Brief → `ParsedBrief` (Claude, or rule-based fallback) → grounded `ProjectExtractionResponse` |
| `app/ai/explainer.py` | Claude explanations with deterministic fallbacks |
| `scripts/eval_extraction.py` | Scores extraction on `tests/fixtures/briefs*.jsonl` |
| `app/core/` | Settings, JWT auth dependencies, rate limiting, activity logging |

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup`, `/auth/login` | none | JWT issuance (client/freelancer signup only) |
| POST | `/search` | none | Filtered pgvector shortlist → ranking → explanation |
| POST | `/projects/extract` | client | NL brief → grounded constraints + ambiguities for review |
| GET/POST/PATCH | `/projects` | client (write, owner only) | Projects |
| GET/POST/PATCH | `/contracts` | project owner / contract party | Hiring & status |
| POST | `/team-builder` | none | CSP team + explanation |
| GET/POST | `/fraud` | none | Bayesian assessment + explanation |
| GET/PATCH | `/freelancers` | owner/admin for writes | Profiles; `/flag` is admin-only |
| GET | `/stats`, `/analytics`, `/activity/*` | none | Dashboards |
| GET | `/graph` | admin | Freelancer→skill graph (PostgreSQL) |
| GET/POST | `/settings/{user_id}` | self/admin | Preferences |
| POST | `/seed` | admin | Demo data (`SEED_ENABLED`) |
| GET | `/health` | none | Dependency status |

## Migrations

```bash
alembic upgrade head                                  # apply
alembic revision --autogenerate -m "describe change"  # after editing app/models/orm.py
```

`tests/test_migrations.py` fails if `orm.py` and the migrations drift apart.

## Seeding

```bash
python -m scripts.seed_database --count 50 --reset
```

Fraud scores of seeded profiles are computed by the fraud model; five profiles are generated with risky traits so the fraud views have data.
