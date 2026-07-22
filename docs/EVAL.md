# ClearHire — Evaluation results

Numbers in this file come from scripts in `backend/scripts/`, each run against the stated fixture. Re-run a script before you change its numbers here.

## Search relevance (Phase 2)

`python -m scripts.eval_retrieval` (real `all-MiniLM-L6-v2` embeddings via fastembed). The fixture is `backend/tests/fixtures/retrieval_eval.json`:

- **Profiles.** 130 profiles from 20 expertise archetypes, generated once with a fixed seed. Bios mix phrasings, about 25% of profiles are under-tagged (one skill), and there are 10 distractors with keyword-stuffed skill tags.
- **Queries.** 20 hand-written client briefs, split into 12 **dev** queries (used to tune weights) and 8 **holdout** queries (never used for tuning).
- **Labels.** A profile's relevance is its archetype's grade in the query's `relevant` map: 2 = core fit, 1 = adjacent. Labels are topical only; budget, rating and seniority are ignored.

Every configuration runs the production pipeline (`app.core.search_pipeline.run_search`) with the same SQL filters, including the must-have skill filter and its relaxed pass.

| Config | dev nDCG@10 | dev Recall@50 | holdout nDCG@10 | holdout Recall@50 |
|---|---|---|---|---|
| keyword only (tsvector) | 0.801 | 0.795 | 0.772 | 0.594 |
| vector only (pgvector) | 0.840 | 0.947 | 0.839 | 0.892 |
| hybrid (RRF, no ranking) | 0.834 | 0.901 | 0.803 | 0.901 |
| vector + ranking | 0.892 | 0.914 | 0.865 | 0.886 |
| **hybrid + ranking (production)** | **0.897** | 0.915 | **0.870** | 0.901 |

Weights (`RANK_WEIGHT_*`) and `SEARCH_KEYWORD_RRF_WEIGHT=0.5` were chosen by a grid sweep on the dev queries. They sit in the middle of a plateau (nDCG@10 0.89–0.90 for any semantic weight of 0.6 or more), not at the single best cell.

How to read these numbers:
- Most of the gain over vector-only comes from the ranking stage. RRF fusion alone is slightly *worse* than vector-only on both splits. The keyword feature adds about 0.005 nDCG on top of vector + ranking, which is within noise for 8–12 queries.
- The corpus is small (130 profiles, 100-candidate shortlist), so retrieval barely filters. These numbers mostly measure ordering, not recall at scale.
- The profiles are synthetic and labelled by archetype. Relative comparisons between configs are more trustworthy than the absolute values.

## Search latency (Phase 2)

`python -m scripts.bench_search`: 10,000 profiles recombined from the eval corpus, 5 rounds of the 20 queries, timing retrieval and ranking including the query embedding (no LLM).

| Run | p50 | p95 |
|---|---|---|
| 2026-07-15, new connection per search | 366 ms | 547 ms |

The target is p95 < 300 ms, so this **fails**. Per-stage profile with a pooled connection, per search: semantic channel 53 ms (two passes), keyword channel 60 ms, query embedding 34 ms, ranking 15 ms, final row load about 60 ms. `EXPLAIN ANALYZE` shows sequential scans for both channels: pgvector's HNSW index isn't chosen with these filters, and the OR tsquery matches about 55% of rows.

## LLM rerank (Phase 3)

Not measured yet: this needs `ANTHROPIC_API_KEY`. Run `python -m scripts.eval_retrieval --rerank`, which adds a "hybrid + LLM rerank" row (about 20 calls, cached per run). If the rerank falls back to deterministic, the script stops instead of reporting fallback numbers as LLM numbers.

## Requirement extraction (Phase 1)

See the Phase 1 status in [`CURRENT.md`](./CURRENT.md). Deterministic parser, holdout set: skills F1 0.94, budget 1.00, deadline 1.00, team size 0.92. The Claude path isn't measured yet.
