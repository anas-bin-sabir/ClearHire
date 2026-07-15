# ClearHire — Product Requirements Document

| | |
|---|---|
| **Product** | ClearHire: AI talent matching, team formation and trust verification for freelance hiring |
| **Status** | Draft v1 · 2026-10-20 |
| **Stack** | Next.js · FastAPI · PostgreSQL + pgvector · Neo4j (derived graph) · Claude API |
| **Implementation plan** | [`CURRENT.md`](./CURRENT.md) |

---

## 1. Problem

Clients hiring freelancers face three problems:

1. **Translating needs into search criteria.** Clients know the outcome they want ("an MVP for a healthcare startup in 6 weeks under $15k"), not the skill filters a marketplace expects. Keyword search misses people whose profiles describe the same skill differently.
2. **Assembling teams.** Most real projects need 2–5 people whose skills together cover the work and whose combined rates fit a budget. Doing this by hand across dozens of profiles is slow and error-prone.
3. **Trust.** Marketplaces contain fake or inflated profiles: copied bios, review-swapping rings, referral farms. Clients can't see these patterns from a single profile page.

## 2. Vision

> Describe your project in plain language. ClearHire turns it into precise requirements, finds and explains the best-fit freelancers, assembles an optimal team within your budget, and warns you about suspicious profiles, showing the evidence for every recommendation.

## 3. Goals & non-goals

**Goals**
- G1: Convert a natural-language brief into validated, editable structured constraints.
- G2: Return a relevant, explained shortlist of freelancers within 2 seconds (excluding optional LLM rerank).
- G3: Produce budget-feasible, skill-complete teams. When none exist, explain which constraint blocks the result and what relaxation would fix it.
- G4: Score every profile for fraud risk with auditable evidence, including graph-level patterns.
- G5: Run publicly as a live, demoable deployment.

**Non-goals (v1)**
- Payments, escrow, invoicing, time tracking.
- Real-time chat between clients and freelancers.
- Identity verification through third-party KYC providers. `id_verified` is an admin-set flag in v1.
- Training custom ML models. v1 uses pretrained embeddings, an LLM, and calibrated rule-based Bayesian scoring.

## 4. Users & roles

| Role | Description | Primary jobs |
|---|---|---|
| **Client** | Founder or manager hiring for a project | Post a project, find freelancers, build a team, hire |
| **Freelancer** | Independent professional | Maintain a profile, see matched projects, understand their trust score |
| **Admin** | Platform operator | Review fraud flags, monitor platform health and analytics, manage demo data |

## 5. User stories

### Client
- **C1** As a client, I paste a free-text project description and see extracted skills, budget, deadline, team size and seniority, which I can edit before saving.
- **C2** As a client, I see when my brief is ambiguous (e.g. "no budget stated") so I can fill the gap.
- **C3** As a client, I search for freelancers by natural language and/or filters, and get a ranked list with a match score and a breakdown (skills, budget fit, experience, rating, trust).
- **C4** As a client, I read why each top candidate fits and what their risks or gaps are, with evidence I can check.
- **C5** As a client, I compare the top two candidates side by side with an explanation of why one ranks higher.
- **C6** As a client, I ask ClearHire to build a team for my project and get up to three alternative teams with cost, skill coverage and collaboration history.
- **C7** As a client, when no team fits, I see which constraint conflicts (budget, skills, size) and one-click alternatives that do work.
- **C8** As a client, I hire a freelancer or a whole team, which creates contracts.
- **C9** As a client, I see a trust indicator on every freelancer card and can open the reasons behind it.

### Freelancer
- **F1** As a freelancer, I sign up and build a profile (skills from a canonical list, rate, bio, portfolio).
- **F2** As a freelancer, I see projects that match my profile.
- **F3** As a freelancer, I see my trust score, the factors affecting it, and how to improve it.
- **F4** As a freelancer, I see my contracts and their status.

### Admin
- **A1** As an admin, I see a queue of flagged profiles with signal contributions, an LLM summary, and the graph neighbourhood (e.g. a referral ring).
- **A2** As an admin, I clear, confirm or suspend a flagged profile. My decision is recorded.
- **A3** As an admin, I see platform stats (users, projects, contracts, searches, flagged rate) and health of every dependency.
- **A4** As an admin, I explore the skill and collaboration graph.
- **A5** As an admin, I reset or seed demo data (disabled in production).

## 6. Functional requirements

### 6.1 Requirement extraction (G1)
| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | `POST /projects/extract` accepts up to 5,000 characters and returns `title, summary, required_skills[{name, importance}], budget?, budget_type, deadline_days?, team_size, seniority_level, domain?, compliance[], implicit_constraints[], ambiguities[]`. | P0 |
| FR-1.2 | Output is schema-validated (LLM structured outputs). Invalid output never reaches the client. | P0 |
| FR-1.3 | Each extracted skill is grounded to a canonical skill (alias → exact → vector similarity) with a confidence. Ungrounded skills are returned as such. | P0 |
| FR-1.4 | Unstated values are `null` and listed in `ambiguities`. Never invent a budget. | P0 |
| FR-1.5 | Without an LLM key, a deterministic parser returns a valid (lower-quality) result. | P1 |
| FR-1.6 | The UI shows editable constraint cards before the project is created. | P0 |

### 6.2 Semantic retrieval & ranking (G2)
| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Freelancer and project embeddings (384-d) are computed on create/update and stored in pgvector with an HNSW index. | P0 |
| FR-2.2 | Retrieval applies hard filters (availability, rate range, min rating, fraud ceiling) in SQL, then ANN ordering, returning ≤100 candidates. | P0 |
| FR-2.3 | Hybrid retrieval fuses vector and full-text results (RRF). | P1 |
| FR-2.4 | Ranking is a weighted, configurable score over semantic similarity, must/nice skill coverage (with adjacent-skill partial credit), budget fit, experience/seniority, rating, availability and trust. A per-feature breakdown is returned. | P0 |
| FR-2.5 | Ranking is deterministic for identical inputs and data. | P0 |

### 6.3 LLM reasoning (G2)
| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | The top 10–15 candidates are optionally reranked by the LLM into `fit_score, strengths[], risks[], evidence[]` via structured output. | P1 |
| FR-3.2 | The final score blends deterministic and LLM scores with a configurable α. The response states whether LLM reasoning was applied. | P1 |
| FR-3.3 | Every strength/risk cites profile fields, past projects or graph facts. Unsupported claims are dropped. | P1 |
| FR-3.4 | Comparative "why #1 over #2" and "biggest gap" explanations are returned for the top 3. | P2 |
| FR-3.5 | Search works fully, with deterministic explanations, when the LLM is unavailable. | P0 |
| FR-3.6 | Results for a project are precomputed in the background on project creation and cached. | P2 |

### 6.4 Graph layer / GraphRAG
| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Neo4j holds Freelancer, Skill, Project and Client nodes with HAS_SKILL, REQUIRES, RELATED_TO, WORKED_ON, COLLABORATED_WITH, REFERRED_BY and REVIEWED edges, synced idempotently from Postgres. | P1 |
| FR-4.2 | Postgres is the source of truth. Graph writes are queued (outbox) so a Neo4j outage never fails a user request. A full rebuild is available. | P1 |
| FR-4.3 | Skill expansion: required skills are expanded 1–2 hops over RELATED_TO for retrieval and partial credit. | P1 |
| FR-4.4 | A compact candidate subgraph (skill paths, prior projects, collaborations) is injected into LLM rerank and team-explanation prompts. | P1 |
| FR-4.5 | With Neo4j disabled, the same features run on a Postgres fallback (recursive CTEs), possibly with reduced depth. | P1 |

### 6.5 Team formation (G3)
| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Inputs: project or ad-hoc constraints (must/nice skills, budget, team size or range, hours per member, max fraud score). | P0 |
| FR-5.2 | The solver (CP-SAT) enforces team size, total cost ≤ budget, coverage of every must-have skill, the fraud ceiling and availability. | P0 |
| FR-5.3 | The objective maximizes candidate fit plus pairwise synergy (prior collaboration, complementary skills) minus fraud risk. | P1 |
| FR-5.4 | Returns up to 3 distinct teams with cost, a coverage matrix and a synergy breakdown, within 2 s for pools ≤200. | P1 |
| FR-5.5 | When infeasible, returns the conflicting constraint and the cheapest feasible relaxations (budget +x%, size ±1, drop nice-to-have skill, relax fraud ceiling), each with a concrete team. | P0 |
| FR-5.6 | Hiring a team creates contracts atomically. | P0 |

### 6.6 Trust & fraud (G4)
| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | A Bayesian log-odds model fuses profile signals (rate/experience mismatch, review anomalies, unverified ID, response rate) with behavioural and graph signals (bio duplication ≥0.92 cosine, referral cycles, reciprocal review rings, signup bursts, rating velocity). | P0 |
| FR-6.2 | Each assessment stores score, confidence, flag status and per-signal contributions. History is kept. | P0 |
| FR-6.3 | New accounts with only "newness" signals get low confidence and are not flagged. | P0 |
| FR-6.4 | Scores recompute on signup, profile update, new review, and in a nightly batch. | P1 |
| FR-6.5 | The admin review queue supports clear/confirm/suspend. Decisions are stored as labels. | P1 |
| FR-6.6 | Freelancers can see their own score factors and improvement tips (no raw thresholds). | P2 |

### 6.7 Platform
| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | Email/password auth (bcrypt + JWT) with client, freelancer and admin roles. The frontend sends the token on every authenticated call. | P0 |
| FR-7.2 | Rate limiting: per-IP public limits, per-user action limits, auth backoff, and a per-user daily LLM call cap. Shared across instances. | P0 |
| FR-7.3 | Audit trail of searches, AI explanations (model, tokens, source) and API activity, with sensitive fields redacted. | P1 |
| FR-7.4 | `/health` reports Postgres, Neo4j, embedding model and LLM configuration status. | P1 |
| FR-7.5 | Schema changes go through Alembic migrations. | P0 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | `/search` p95 < 300 ms without LLM rerank and < 4 s with it, at 10k freelancers. Team solve < 2 s for ≤200 candidates. Extraction < 5 s. |
| **Availability & degradation** | Core flows (signup, project, search, team) work if the LLM or Neo4j is down. Responses state when AI features are degraded. |
| **Security** | Secrets only in the environment. CORS locked to the frontend origin in production. Admin-only seed/rebuild endpoints. LLM input length limits. Prompt content is treated as untrusted data. |
| **Privacy** | No PII sent to the LLM beyond the profile fields needed for matching. Hashed IPs for fraud signals. Logs redact credentials. |
| **Explainability** | Every score (match, team, fraud) comes with a machine-readable breakdown and a human-readable explanation. |
| **Determinism & testability** | Non-LLM components are deterministic. Tests run with `EMBEDDING_PROVIDER=hash` and no external API. CI runs backend tests and the frontend build. |
| **Cost** | LLM spend per search ≤ ~$0.02 at default settings (prompt caching, top-k cap, cached results per project). Configurable model via `ANTHROPIC_MODEL`. |
| **Deployability** | API image < 1 GB and runs in 512 MB RAM (ONNX embeddings, no PyTorch). |

## 8. Success metrics

| Metric | Target | Measured by |
|---|---|---|
| Extraction skill F1 | ≥ 0.85 | 30-brief labelled set |
| Extraction budget/deadline accuracy | ≥ 90% | same set |
| Retrieval nDCG@10 (hybrid + ranking) | > vector-only baseline | 20 labelled projects |
| Team solver optimality | = brute-force optimum on small cases | randomized tests |
| Fraud flag precision / recall | ≥ 0.8 / ≥ 0.7 | seeded fraud scenarios |
| False flags on new legitimate accounts | 0 in the seeded set | seeded scenarios |
| Demo funnel completion | brief → matches → team → hire in < 3 min | manual walkthrough |

Evaluation results are published in `docs/EVAL.md`.

## 9. System overview

```
Next.js (Vercel) ──JWT──► FastAPI (Render)
                            │
     ┌──────────────────────┼─────────────────────────┐
     ▼                      ▼                         ▼
 PostgreSQL + pgvector   Neo4j (AuraDB)          Claude API
 source of truth         derived graph,          extraction, rerank,
 embeddings, HNSW,       synced via outbox;      explanations
 audit, outbox           optional
```

Request flow for matching:
`brief → extract (LLM, schema) → ground skills (taxonomy + pgvector) → hybrid retrieve (SQL + ANN + FTS) → graph expand/context (Neo4j | CTE) → deterministic rank → LLM rerank (optional) → explained results`

Team flow:
`constraints → per-skill retrieval → dominance pruning → CP-SAT (fit + synergy − risk) → top-3 teams | relaxations → grounded explanation`

## 10. Release plan

| Milestone | Contents (see CURRENT.md phases) | Demo |
|---|---|---|
| **M0 Stable** | Phase 0 | Existing flows work end-to-end with tests |
| **M1 Smart matching** | Phases 1–2 (+7 deploy) | Live: paste brief → ranked matches |
| **M2 Reasoning** | Phase 3 | Evidence-backed explanations, compare view |
| **M3 Graph & teams** | Phases 4–5 | Graph-aware matches, optimal teams with relaxations |
| **M4 Trust** | Phase 6 | Fraud queue with ring detection |

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM hallucinates skills or claims | Schema-constrained output, taxonomy grounding, evidence citations validated server-side |
| LLM cost or latency spikes | Cap top-k, prompt caching, per-project result cache, daily per-user cap, deterministic fallback |
| Two-database drift (Postgres ↔ Neo4j) | Postgres authoritative, outbox + idempotent MERGE, full rebuild endpoint |
| Free-tier hosting limits (RAM, pgvector availability) | ONNX embeddings; Neon/Supabase for pgvector; AuraDB Free |
| Fraud model penalizes legitimate newcomers | Confidence levels, newness-only dampening, admin labels for calibration |
| Synthetic seed data inflates metrics | Hand-labelled eval sets, explicitly documented as synthetic |

## 12. Open questions

1. Keep Neo4j (recommended), or rebrand to Postgres-only graph retrieval? This affects Phase 4 and the project description.
2. Should freelancers see the client's brief text before being hired, or only extracted requirements?
3. Is LLM rerank on by default for all clients, or an explicit "deep match" action that respects the per-user cap?
4. Do admin fraud decisions feed back into LLR calibration automatically, or only through manual review?
