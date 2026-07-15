# ClearHire — Current State & Gap-Closing Plan

_Last audited: 2026-10-20, against the uncommitted working tree on `main` (after `fc7cd5a`)._

This document compares the codebase against the project's target description:

> **ClearHire** | LLM API, Semantic Retrieval, Next.js, FastAPI, PostgreSQL — **Live**
> - AI talent-matching platform that converts natural-language project requirements into structured constraints and combines semantic retrieval, ranking, and LLM reasoning to match clients with suitable freelancers.
> - AI team-formation and trust layer using constraint optimization, fraud scoring, and Neo4j GraphRAG to assemble teams under budget and skill constraints and identify suspicious profiles.

It then lays out a phased plan to close the gaps. The product requirements live in [`PRD.md`](./PRD.md).

---

## 1. Claim-by-claim status

| Claim in description | Status | Evidence / gap |
|---|---|---|
| **Next.js** frontend | 🟡 Partial | 20+ pages exist (client / freelancer / admin + landing). Several call endpoints that are not mounted (`/graph`, `/stats`, `/analytics`, `/activity/*`). The API client never sends the JWT, so authenticated routes (e.g. `POST /projects`) return 401. No page uses `/projects/extract`. |
| **FastAPI** backend | 🟡 Partial | App boots on Postgres only. `stats`, `analytics`, `activity`, `user_settings` routers exist but aren't included in `main.py`; `settings.py` and `user_settings.py` duplicate each other. No tests, no migrations (schema changes are `ALTER TABLE` statements in `init_postgres`). |
| **PostgreSQL** (+pgvector) | 🟢 Mostly done | Single source of truth. `Vector(384)` columns plus HNSW indexes on `freelancers` and `projects`. Activity logs, search history, AI explanations and settings were moved from Mongo into Postgres tables. |
| NL requirements → **structured constraints** | 🟡 Partial | `POST /projects/extract` and `ai/project_parser.py` exist. The LLM output is parsed with `json.loads` and has no schema enforcement. The regex fallback knows only 9 skills. Skills are not grounded to a canonical taxonomy. No review UI: the "new project" page is still a manual 3-step form. |
| **Semantic retrieval** | 🔴 Broken | `FreelancerRepository.semantic_search` does a correct pgvector `cosine_distance` ANN query, but it returns `(Freelancer, similarity)` tuples. `routers/search.py` passes those tuples to `to_ranked_dicts()`, which expects ORM objects, so `/search` fails whenever a query is given. The similarity score is also discarded, so `embedding_similarity` is always 0 in ranking. |
| **Ranking** | 🟡 Partial | Two parallel implementations: `ai/ranking.py` (clean weighted scoring with config weights) and `ai/astar.py` (legacy "A*" labels). `/search` still uses `astar`. Skill matching is exact string equality, with no synonym or adjacency credit. There's no offline evaluation set or metric. |
| **LLM reasoning** | 🟡 Partial | `ai/explainer.py` writes post-hoc summaries over already-ranked results. The LLM never evaluates candidates (no rerank and no comparative judgement). The output is free text parsed line by line. The default model `claude-3-5-haiku-latest` is retired, and `temperature=0` is rejected by current models. `anthropic==0.42.0` is very old. Every exception is swallowed silently. |
| **Constraint optimization** (team formation) | 🟡 Partial | `ai/csp.py` uses backtracking with forward checking and MRV-style ordering. `ai/team_solver.py` adds failure diagnosis and relaxation hints. There's no objective beyond cost and feasibility, and no synergy term. Relaxations are text hints, not re-solved alternatives. Two module layers (`csp` and `team_solver`) overlap. |
| **Fraud scoring** | 🟡 Partial | `ai/bayesian.py` does log-odds naive-Bayes fusion over 7 per-profile signals. `ai/fraud.py` dampens scores for new accounts. Signals are static field checks; `copied_portfolio` isn't computed from data. The seeder hardcodes `fraud_score=0.85` for "suspicious" profiles. There's no recompute pipeline and no graph signals, despite the `referred_by_id` column existing. |
| **Neo4j GraphRAG** | 🔴 Missing (removed) | The working tree **deletes** `neo4j_client.py`, `graph_repository.py`, `routers/graph.py` and the agents. Graph data that remains: `skill_relationships` (5 hardcoded pairs), `contracts` (implicit co-worker edges), `referred_by_id`. Nothing does graph retrieval or puts graph context into prompts. The admin "graph" page has no backend. |
| **Live** | 🔴 Not live | `render.yaml` defines the API and a free Postgres. `sentence-transformers` pulls in PyTorch, which won't fit a 512 MB free instance. The free Render Postgres plan may not offer pgvector, so check this. There's no frontend deploy config, no production NextAuth secret, and the seeding path needs the full model. |

Legend: 🟢 meets the claim, 🟡 partially implemented, 🔴 broken or missing.

---

## 2. What is already solid (keep it)

- **Repository pattern.** Routers don't run raw SQL; every repo in `app/db/repositories/postgres/` takes an `AsyncSession`.
- **pgvector setup.** `Vector(384)`, HNSW indexes (`m=16, ef_construction=64`), and filter-then-ANN SQL in `semantic_search`.
- **Embedding service.** `app/ai/embeddings.py` builds profile and project text and has a `hash` provider for tests.
- **Ranking design.** `app/ai/ranking.py` exposes weights through config, returns an explainable `ScoreBreakdown`, and is deterministic.
- **Bayesian fraud model.** Signal LLRs, posterior, confidence, and auditable `contributions`. New accounts get a low-confidence score instead of being auto-flagged (`ai/fraud.py`).
- **Team CSP.** Forward checking, prune stats, and diagnosis of the failing constraint.
- **Security.** bcrypt passwords, JWT, role guards, and a layered rate limiter (per-IP and per-account auth backoff).
- **Audit trail.** Activity logs, search history, and stored AI explanations, all in Postgres.

---

## 3. Architecture decision: Neo4j

The working tree is moving to **Postgres only**, but the description promises **Neo4j GraphRAG**. Pick one so the code and the description agree.

**Recommendation: bring Neo4j back as a *derived read model*, not as a second source of truth.**

- Postgres stays authoritative. Neo4j is rebuilt or upserted from Postgres with idempotent `MERGE`. Losing Neo4j means losing graph features, not losing data.
- Neo4j is **optional at runtime**. With `NEO4J_URI` unset, graph features degrade to a Postgres fallback (recursive CTE over `skill_relationships` and `contracts`). Local dev and tests keep working with one database.
- Hosting: Neo4j AuraDB Free is enough for demo scale.

The alternative is to keep Postgres-only and change the description to "graph-augmented retrieval over PostgreSQL". That's less work, but it drops a headline claim. The phases below assume the recommendation; Phase 4 is the only part that changes if you choose otherwise.

---

## 4. Known defects to fix first

| # | Location | Defect |
|---|---|---|
| D1 | `routers/search.py:30-36` | `semantic_search()` returns tuples, but `to_ranked_dicts()` expects ORM rows. `/search` with a query crashes, and similarity is never propagated. |
| D2 | `routers/search.py:4` | Uses legacy `ai.astar.rank_freelancers` instead of `ai.ranking`. |
| D3 | `main.py` | `stats`, `analytics`, `activity` routers aren't mounted; the frontend calls them. `/graph` is gone but still listed at `/`. |
| D4 | `frontend/lib/api.ts:303` | `req()` never attaches `Authorization: Bearer <token>`, so authenticated endpoints 401 from the UI. |
| D5 | `ai/explainer.py` | Retired model ID, `temperature=0` (rejected on current models), bare `except Exception: return None` hides every API error. |
| D6 | `db/seed/seeder.py:13` | Imports the old `db/utils/embeddings.embed_text`, which ignores `EMBEDDING_PROVIDER=hash`, so seeding always needs PyTorch. Two embedding modules exist. |
| D7 | `db/seed/seeder.py:145` | Fraud scores are hardcoded rather than computed by the fraud model. |
| D8 | `routers/projects.py` | `POST /projects/extract` has no rate limit or auth, so the LLM endpoint is open to abuse. |
| D9 | `routers/search.py:119-136` | `/precomputed` and `/agent-status` are stubs left from the deleted agents. |
| D10 | `.env.example` | `DATABASE_URL` uses port 5432, but docker-compose exposes 5435. |
| D11 | Repo-wide | No tests and no migration tool. README still documents Mongo and Neo4j setup that no longer exists. |

---

## 5. Phased implementation plan

Each phase ends in a shippable, demoable state. Phases 1–3 deliver the first bullet of the description and Phases 4–6 the second. Phase 7 makes the project "Live".

### Phase 0 — Stabilize the baseline (≈2–3 days) — ✅ implemented 2026-10-20

> Also fixed during Phase 0: `/search` called a non-existent `filter_dicts` (failed on every request); seeder `NameError` on project creation; signup allowed `role: "admin"`; project PATCH and contract writes had no ownership checks; `/seed` was unauthenticated; the fraud router's error path raised `TypeError`; `render.yaml` didn't set `SECRET_KEY`; the agent-status badge polled a stub forever; `/search` activity was double-logged; `ContractRepository.upsert` no longer existed, so every hire and the seeder failed (now `get_pair`/`create`, with status transitions enforced); the generic `ARRAY` type lacked `overlap`, so multi-skill search failed; the CSP forward check over-estimated cost and pruned valid teams (caught by a brute-force test); `app.core` had a circular import that broke the seed CLI.
>
> Open follow-up: `npm run lint` reports 90 pre-existing errors (63 `no-explicit-any`). CI runs lint as non-blocking until those are cleaned up.

**Goal:** the current feature set works end-to-end on Postgres, with tests, before new AI work.

1. **Fix search (D1, D2).** Have `semantic_search` feed `similarity` into `to_ranked_dicts` (pass `(row, sim)` pairs or attach the value to the dict). Switch `/search` to `ai.ranking.rank_freelancers`. Delete `ai/astar.py` or reduce it to a re-export.
2. **Consolidate duplicates.** Keep one embeddings module (`app/ai/embeddings.py`; delete `db/utils/embeddings.py`). Keep one fraud entry point (`ai.fraud.score_fraud`). Keep one team entry point (`ai.team_solver.solve_team`). Keep one settings router.
3. **Mount routers (D3).** Include `stats`, `analytics`, `activity`. Remove `/graph` from the root listing until Phase 4. Delete the stub endpoints (D9) or return 404.
4. **Frontend auth (D4).** Store the backend JWT in the NextAuth session (`jwt`/`session` callbacks). Have `req()` attach the bearer token. Remove `DEMO_USERS` from client code and authenticate only against the backend.
5. **Migrations.** Add Alembic. Generate a baseline from `orm.py` and move the `ALTER TABLE` and HNSW statements from `init_postgres` into a migration.
6. **Tests.** Add `pytest` and `pytest-asyncio` against a `pgvector/pgvector:pg16` service container, with `EMBEDDING_PROVIDER=hash`. Cover ranking, CSP, fraud, the search router, auth and rate limiting. Add GitHub Actions CI (backend tests plus `next build` and lint).
7. **Docs and config (D10, D11).** Fix `.env.example`. Rewrite both READMEs for the Postgres(+optional Neo4j) setup.

**Exit criteria:** `pytest` is green in CI. A logged-in client can create a project, search, and build a team from the UI with no 401s or 500s.

---

### Phase 1 — Natural-language requirements → structured constraints (≈3–4 days) — ✅ implemented 2026-10-21

> **Status.** `anthropic` 1.15 with `app/ai/llm.py` (structured outputs via `messages.parse`, typed errors, refusal/truncation handling, token usage logged per call). Default model `claude-haiku-5-5` (the project already used Haiku). Taxonomy of 143 skills in `app/ai/skill_taxonomy.py`, mirrored to a `skills` table with embeddings (migration `0002`, which also canonicalized existing data). The "Describe it" review flow is the default on `/client/projects/new`.
>
> **Measured (deterministic fallback, `python -m scripts.eval_extraction`):**
>
> | Set | Skills F1 | Budget | Deadline | Team size |
> |---|---|---|---|---|
> | dev (30 briefs, used for tuning) | 1.00 | 1.00 | 1.00 | 0.97 |
> | holdout (12 briefs, never tuned on) | 0.94 | 1.00 | 1.00 | 0.92 |
>
> The holdout row is the honest number. **The Claude path hasn't been measured yet:** no API key was available. Run `python -m scripts.eval_extraction --llm --set holdout` (about 12 calls) to check the ≥ 0.85 F1 target.
>
> **Carried into Phase 2:** ranking still ignores `nice_to_have_skills` and treats every budget as a total, so an `hourly` budget isn't interpreted yet. The semantic-grounding threshold (`SKILL_GROUNDING_MIN_SIMILARITY=0.72`) is unvalidated against the real MiniLM model, because tests use hash embeddings.

**Goal:** a client pastes a brief and gets validated, editable constraint cards.

1. **LLM client module** (`app/ai/llm.py`):
   - Upgrade `anthropic` to the current SDK. Use `AsyncAnthropic` as a module-level singleton.
   - Default `ANTHROPIC_MODEL=claude-opus-5-5`; it stays configurable through env. Remove `temperature`, which current models reject, and control depth with `output_config.effort` (`low` for extraction).
   - Catch typed SDK errors (`RateLimitError`, `APIStatusError`, `APIConnectionError`), log `request_id`, and check `stop_reason` (including `refusal`) before reading content.
   - Record input/output tokens and latency per call in `ai_explanations.metadata_json`.
2. **Schema-enforced extraction.** Replace `json.loads` with structured outputs (`client.messages.parse()` with the `ExtractedProjectRequirements` Pydantic model). Extend the schema:
   - `budget: float | None` (null when not stated, replacing the "use 1" sentinel)
   - `budget_type: "fixed" | "hourly"`, `deadline_days: int | None`
   - `required_skills: list[{name, importance: "must"|"nice"}]`
   - `domain` (e.g. healthcare or fintech), `compliance` (e.g. HIPAA)
   - `ambiguities: list[str]` for things the client should confirm
3. **Skill taxonomy and grounding.**
   - New `skills` table: `id, canonical_name, aliases[], category, embedding vector(384)`. Seed about 150 skills with aliases ("ReactJS"→"React", "postgres"→"PostgreSQL").
   - `SkillRepository.ground(names)`: exact or alias match first, then pgvector nearest neighbour over skill embeddings with a similarity threshold. Return `{input, canonical, confidence}`.
   - Store canonical names everywhere (projects, freelancers). Backfill existing rows.
4. **Deterministic fallback.** Keep the regex parser for when the API key is missing, but ground its output through the taxonomy instead of the 9-skill list.
5. **API.** `POST /projects/extract` requires the client role and uses the user-action rate limit. It returns extracted fields, grounding results, and ambiguities.
6. **Frontend.** On `/client/projects/new`, add a "Describe your project" textarea. Show extracted constraint cards: skill chips with must/nice toggle and grounding confidence, a budget badge, a deadline, a team-size slider, and an ambiguity callout. The client edits, then confirms to `POST /projects`. Keep the manual form as an "advanced" tab.
7. **Eval set.** Write 30 hand-labelled briefs in `backend/tests/fixtures/briefs.jsonl`. Run a script that reports per-field accuracy (skills F1, budget and deadline exact match).

**Exit criteria:** on the eval set, skills F1 ≥ 0.85 and budget/deadline accuracy ≥ 90% with the LLM. Without a key the fallback still returns valid output.

---

### Phase 2 — Semantic retrieval & hybrid ranking (≈3 days)

**Goal:** fast, measurably relevant shortlist from Postgres.

1. **Embedding footprint.** Replace `sentence-transformers` (PyTorch) with `fastembed` (ONNX), which runs the same `all-MiniLM-L6-v2` at 384 dimensions, so stored vectors stay compatible. Load it once at startup.
2. **Richer profile text.** Embed `headline + bio + canonical skills + past project titles` (from contracts). Re-embed on profile change and after a contract completes.
3. **Hybrid retrieval in SQL.** Apply hard filters (availability, rate range, fraud ceiling) and `skills && required_must_skills` in the `WHERE`. Order by cosine distance with `LIMIT 100`. Add a fallback pass without the skill overlap when fewer than *k* results come back. Tune `SET hnsw.ef_search` per query.
4. **Keyword channel.** Add a Postgres full-text `tsvector` over the bio. Merge the semantic and keyword lists with Reciprocal Rank Fusion before scoring.
5. **Ranking upgrades** (`ai/ranking.py`):
   - Skill coverage weights must-have skills over nice-to-have skills and gives partial credit for adjacent skills (Phase 4 supplies graph adjacency; until then use `skill_relationships`).
   - Add a seniority-fit feature from `experience_years` versus `seniority_level`.
   - Keep the breakdown exposed per candidate.
6. **Offline relevance eval.** Label 20 projects with relevant freelancers in the seed data. Report nDCG@10 and Recall@50 for (a) keyword only, (b) vector only, (c) hybrid + ranking. Commit the numbers in `docs/EVAL.md`.

**Exit criteria:** `/search` p95 under 300 ms for 10k seeded freelancers, excluding the LLM. Hybrid nDCG@10 beats the vector-only baseline.

---

### Phase 3 — LLM reasoning over the shortlist (≈3 days)

**Goal:** the LLM evaluates candidates rather than summarizing a finished list.

1. **LLM rerank stage.** Send the top 10–15 from Phase 2 to Claude with the structured project and compact candidate cards: skills, rates, ratings, past projects, and in Phase 4 the graph context. Use a structured output schema of `[{freelancer_id, fit_score 0-100, strengths[], risks[], evidence[]}]`.
2. **Blend, don't replace.** `final = α·deterministic + (1-α)·llm_fit`, with α configurable (default 0.6). Fall back to the deterministic score when the LLM is unavailable. The response says which path ran.
3. **Grounded explanations.** Each claim in `strengths`/`risks` must cite a field or past project ID. Reject or strip unverifiable claims server-side.
4. **Comparative and counterfactual reasoning.** For the top 3, produce "why #1 over #2". Report the single biggest gap per candidate ("missing Kubernetes; adjacent: Docker").
5. **Cost and latency controls.** Use prompt caching on the stable system prompt and schema. Cache results per `(project_id, candidate_set_hash)` in `ai_explanations`. Run the rerank as a background task when a project is created, so `/search/precomputed/{project_id}` returns real data and replaces the stub.
6. **UI.** The `AIReasoningBox` shows strengths, risks and evidence per card, plus a "compare top 2" drawer.

**Exit criteria:** on the Phase 2 eval set, the blended ranking improves nDCG@10 or matches it with better explanations, verified manually on 10 cases. Search works with the LLM disabled.

---

### Phase 4 — Neo4j graph layer & GraphRAG (≈4–5 days)

**Goal:** the graph changes retrieval, team building and fraud results, beyond the admin visualization.

1. **Infrastructure.** Re-add the `neo4j` async driver, gated on `NEO4J_URI`. Add a `neo4j:5` service to docker-compose. Have `/health` report its status.
2. **Graph model.**
   - Nodes: `(:Freelancer {id})`, `(:Skill {name, category})`, `(:Project {id})`, `(:Client {id})`.
   - Edges: `HAS_SKILL {level}`, `REQUIRES {importance}`, `RELATED_TO {weight}` (skill ontology), `WORKED_ON {status, rating}`, `POSTED`, `REFERRED_BY`, `REVIEWED {rating}`.
   - Derive `COLLABORATED_WITH {count, avg_rating}` from pairs that share a `WORKED_ON` project.
3. **Sync.** `app/graph/sync.py` provides idempotent `MERGE` upserts, called after commits in the freelancer, project and contract repositories. Writes go through a Postgres `outbox` table drained by a background task, so a Neo4j outage doesn't fail the request. `POST /admin/graph/rebuild` does a full rebuild.
4. **Skill ontology.** Seed `RELATED_TO` edges from the Phase 1 taxonomy categories plus a curated list (about 300 edges), weighted by embedding similarity between skills.
5. **GraphRAG retrieval** (`app/graph/context.py`):
   - **Skill expansion:** for each required skill, add 1–2-hop related skills with decayed weight. This feeds the adjacency credit in ranking and the candidate recall in retrieval.
   - **Candidate subgraph:** for the shortlist, extract each candidate's skill paths to required skills, past projects with similar skills, and collaboration edges with other shortlisted people. Serialize it as compact JSON or triples.
   - **Prompt injection point:** the Phase 3 rerank and the team explanation both receive this subgraph, so the LLM can say things like "A and B shipped project X together (4.8★)".
6. **Postgres fallback.** The same `context.py` interface is backed by recursive CTEs when Neo4j is disabled.
7. **Admin graph page.** Restore `GET /graph` (a subgraph around a freelancer or project, with fraud scores) for the existing D3 page.

**Exit criteria:** with Neo4j on, the eval shows recall improvement on queries for rare skills, and explanations cite graph facts. With it off, every test still passes.

---

### Phase 5 — Team formation as constraint optimization (≈3 days)

**Goal:** optimal (not just feasible) teams, plus actionable alternatives when infeasible.

1. **Solver.** Replace the hand-written backtracking with OR-Tools CP-SAT in `ai/team_solver.py`. Keep `csp.py` as a fallback and as a teaching reference.
   - Variables: `x_i ∈ {0,1}` per candidate, plus an optional role assignment `y_{i,s}`.
   - Hard constraints: `Σx = K` (or a range); `Σ x_i·rate_i·hours_i ≤ budget`; skill coverage `Σ_{i∈S(s)} x_i ≥ 1` for each must-have skill; `fraud_i ≤ max`; availability.
   - Objective: maximize `Σ fit_i·x_i + λ·Σ synergy_ij·z_ij − μ·Σ fraud_i·x_i`, where `z_ij` linearizes `x_i ∧ x_j` and `synergy_ij` comes from `COLLABORATED_WITH` and complementary-skill scores (Phase 4).
2. **Pre-pruning.** Run Phase 2 retrieval per required skill (top 15 each), deduplicate, and drop dominated candidates before solving. Set a 2 s solver time limit.
3. **Top-N teams.** Return the best 3 distinct teams (by adding no-good cuts) with cost, coverage and synergy breakdown.
4. **Infeasibility → counterfactuals.** On INFEASIBLE, re-solve automatically with relaxations: budget +10/20/30%, team size ±1, each nice-to-have skill dropped, and fraud ceiling +0.1. Return the cheapest relaxations that become feasible, with their concrete teams. Examples: "+$600 budget gives 3 options" or "drop 'Figma' gives 2 options".
5. **LLM explanation.** Explain team trade-offs grounded in the solver output plus the subgraph. Use structured output.
6. **UI.** The team-builder page shows the 3 teams as side-by-side cards, a coverage matrix (skills × members), a budget bar, and a "relaxation suggestions" panel with one-click re-run. "Hire team" calls `contracts/batch`.

**Exit criteria:** solves pools of 200 candidates and 8 skills in under 2 s. Matches the brute-force optimum on small randomized tests in `tests/test_team_solver.py`.

---

### Phase 6 — Trust & fraud layer (≈3–4 days)

**Goal:** fraud scores computed from real behavioural and graph evidence, with an admin review loop.

1. **Data you need but don't have yet.** Add a `reviews` table (`contract_id, reviewer_id, reviewee_id, rating, text, created_at`), `freelancers.id_verified`, and `freelancers.last_active_at`. Make the seeder generate realistic fraud scenarios: duplicated bios, referral rings, review swaps, and rate/experience mismatch.
2. **New signals:**
   - **Bio and portfolio duplication:** pgvector nearest neighbour on the bio embedding, flagged when similarity ≥ 0.92 to another account.
   - **Referral cycles:** Cypher `MATCH p=(f)-[:REFERRED_BY*2..5]->(f)`, or a recursive CTE fallback.
   - **Collusive review rings:** dense mutual `REVIEWED` subgraphs (reciprocal 5★ reviews within a short window, small cliques). Use Neo4j GDS where available, otherwise a reciprocal-pair heuristic.
   - **Burst behaviour:** many accounts created from the same IP or device in a short window. The rate limiter already sees IPs; persist a hashed IP at signup.
   - **Rating velocity:** rating that's too high or too fast relative to account age.
3. **Bayesian fusion.** Add the new signals with documented LLR values to `ai/bayesian.py`. Calibrate the LLRs on the labelled seeded data, and report precision/recall at the flag threshold in `docs/EVAL.md`.
4. **Pipeline.** Recompute the fraud score on signup, on profile update, on a new review, and in a nightly batch for graph signals. Store each assessment with its signal contributions, so there's history.
5. **Search integration.** Fraud affects ranking (an existing weight) and filters at the hard ceiling. Low-confidence new accounts are labelled as such but not penalized.
6. **Admin review queue.** The `/admin/fraud` page lists flagged profiles with their signal contributions, the graph neighbourhood (ring visualization), an LLM summary, and actions (clear, confirm, suspend). Admin decisions are stored as labels for future calibration.

**Exit criteria:** on seeded scenarios, flag precision ≥ 0.8 and recall ≥ 0.7. New legitimate accounts are not flagged.

---

### Phase 7 — Go live & hardening (≈2–3 days)

1. **Deploy.**
   - API on Render with a Dockerfile, the fastembed model baked into the image, and `alembic upgrade head` on release.
   - Postgres with pgvector: Neon or Supabase if the Render free plan lacks the extension.
   - Neo4j on AuraDB Free.
   - Frontend on Vercel, with `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and `NEXT_PUBLIC_API_URL` set and CORS locked to the Vercel domain.
2. **Secrets and safety.** `SECRET_KEY` and the API keys come from the environment only. `/seed` is admin-only and disabled in production. Add an LLM spend guard (per-user daily cap on extract and rerank calls).
3. **Shared rate-limit store.** The rate limiter is in-memory per process; back it with Postgres (or Redis if added) so limits hold across instances.
4. **Observability.** Structured JSON logs and a request ID. Log LLM token and cost per request. Extend `/health` with Postgres, Neo4j, embedding model and LLM configuration status. Show basic metrics on the admin analytics page.
5. **Demo readiness.** Load a seeded demo dataset (≈500 freelancers, 50 projects, contracts, reviews, fraud scenarios) and add a one-click "reset demo" for admins. Update the README with the live URL, architecture diagram and eval numbers.

**Exit criteria:** a public URL where a visitor can sign in as a demo client, paste a brief, see ranked and explained matches, build a team, and as admin review flagged profiles.

---

## 6. Sequencing & effort summary

```
Phase 0  Stabilize ───────────► required first
Phase 1  NL → constraints ───┐
Phase 2  Retrieval + ranking ┼─► Bullet 1 of the description
Phase 3  LLM rerank/reasoning┘
Phase 4  Neo4j GraphRAG ─────┐   (feeds 3, 5, 6)
Phase 5  Team optimization ──┼─► Bullet 2 of the description
Phase 6  Trust & fraud ──────┘
Phase 7  Live ────────────────► can start in parallel after Phase 2
```

Rough total: **23–28 working days** for one developer. If time is short, ship 0 → 1 → 2 → 7 first (a live, honest version of bullet 1), then 4 → 5 → 6 → 3.

## 7. New dependencies (expected)

| Package | Phase | Purpose |
|---|---|---|
| `alembic`, `pytest`, `pytest-asyncio`, `httpx` | 0 | migrations, tests |
| `anthropic` (current release) | 1 | structured outputs, typed errors |
| `fastembed` (replaces `sentence-transformers`) | 2 | small ONNX embeddings for deployment |
| `neo4j` | 4 | graph driver |
| `ortools` | 5 | CP-SAT team optimization |
