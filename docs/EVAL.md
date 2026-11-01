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

## Graph expansion on rare skills (Phase 4)

`python -m scripts.eval_retrieval --set rare [--retrieval-limit N]`, run 2026-10-31 with real MiniLM embeddings. "+ graph" runs the same pipeline with the Postgres `GraphContext` (recursive CTEs over `skill_relationships`, 2 hops, decay 0.5). Neo4j gives the same expansion (backend parity is tested), so these numbers hold for both backends.

- **Fixture.** `backend/tests/fixtures/retrieval_eval_rare.json` has 14 queries over the same 130 profiles. Each query's must-have skill is tagged on at most 2 profiles, and on none for 6 of the 14 (for example BigQuery, Flask, Svelte, scikit-learn). Labels use the same archetype scheme and were written before the first run.
- **What the graph changes.** (1) Ranking gets multi-hop partial credit from `expand_skills`, merged with the curated adjacency. (2) When the strict must-have filter returns fewer than 20 candidates, an *expanded* pass first admits holders of related skills (weight ≥ 0.2), ordered by RRF plus graph affinity. After that the relaxed pass tops the shortlist up to the limit as before.

| Shortlist size | Config | nDCG@10 | Recall@50 |
|---|---|---|---|
| 100 (production) | hybrid + ranking | 0.783 | 0.906 |
| 100 (production) | hybrid + ranking + graph | **0.798** | 0.906 |
| 50 | hybrid + ranking | 0.782 | 0.898 |
| 50 | hybrid + ranking + graph | **0.798** | **0.929** |
| 30 | hybrid + ranking | 0.772 | 0.818 |
| 30 | hybrid + ranking + graph | **0.809** | **0.874** |

How to read these numbers:
- **Recall improves only when the shortlist is the bottleneck.** At the production limit of 100 of 130 profiles, the shortlist already holds nearly the whole corpus, so recall ties. With 30–50 slots (closer to what 100 slots means at 10k profiles), the expanded pass brings in related-skill holders that would otherwise be cut. Rare-skill Recall@50 then rises by 3–6 points.
- **The nDCG gain comes from ranking credit.** Examples: Svelte 0.37 → 0.52 (React/Vue holders), Prompt Engineering 0.62 → 0.71. At limit 100 one query loses a little (BigQuery 0.96 → 0.94), and 11 of 14 are unchanged.
- **A first version hurt recall.** In that version, the expanded pass satisfied `min_results` and skipped the relaxed top-up. That cut Recall@50 to 0.859 (Flask and scikit-learn expand to Python, which 19 profiles hold). The relaxed pass now always tops up after an expanded pass.

The same run on the original sets (limit 100) shows no regression in nDCG. It does show one recall dip on holdout:

| Set | Config | nDCG@10 | Recall@50 |
|---|---|---|---|
| dev | hybrid + ranking | 0.904 | 0.915 |
| dev | hybrid + ranking + graph | 0.904 | 0.915 |
| holdout | hybrid + ranking | 0.869 | 0.921 |
| holdout | hybrid + ranking + graph | **0.882** | 0.901 |

The holdout recall drop comes from the Vue (0.86 → 0.79) and Unity (1.00 → 0.92) queries. Adjacency credit lifts JavaScript and C# holders from non-relevant archetypes into the top 50 ahead of grade-1 profiles that share no skill edge. The "hybrid + ranking" baseline here differs slightly from the Phase 2 table above (dev nDCG 0.904 vs 0.897, holdout Recall@50 0.921 vs 0.901). The Phase 2 numbers weren't re-run before this change, so the cause of that drift isn't established.

## LLM rerank (Phase 3)

Not measured yet: this needs `ANTHROPIC_API_KEY`. Run `python -m scripts.eval_retrieval --rerank`, which adds a "hybrid + LLM rerank" row (about 20 calls, cached per run). If the rerank falls back to deterministic, the script stops instead of reporting fallback numbers as LLM numbers.

## Requirement extraction (Phase 1)

See the Phase 1 status in [`CURRENT.md`](./CURRENT.md). Deterministic parser, holdout set: skills F1 0.94, budget 1.00, deadline 1.00, team size 0.92. The Claude path isn't measured yet.
