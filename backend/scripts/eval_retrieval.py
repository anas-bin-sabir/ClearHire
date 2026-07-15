"""Offline relevance eval for /search: keyword vs vector vs hybrid (+ ranking).

Usage (from backend/):
  python -m scripts.eval_retrieval                  # all queries, real MiniLM embeddings
  python -m scripts.eval_retrieval --set holdout    # queries never used for tuning
  python -m scripts.eval_retrieval --weight keyword=0.1 --weight semantic=0.25
  python -m scripts.eval_retrieval --verbose        # per-query nDCG

Loads tests/fixtures/retrieval_eval.json into EVAL_DATABASE_URL (its public schema is
DROPPED and rebuilt) and runs each query through app.core.search_pipeline.run_search,
the same code POST /search uses, minus the LLM explanation.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

EVAL_DATABASE_URL = os.environ.get(
    "EVAL_DATABASE_URL",
    "postgresql+asyncpg://clearhire:clearhire123@localhost:5436/clearhire_eval",
)
os.environ.update(
    {
        "DATABASE_URL": EVAL_DATABASE_URL,
        # Pooled like production: one event loop, so connections can be reused.
        "DB_NULL_POOL": "false",
        "AUTO_MIGRATE": "true",
        "ANTHROPIC_API_KEY": "",
    }
)
os.environ.setdefault("EMBEDDING_PROVIDER", "local")

from sqlalchemy import text  # noqa: E402

from app.ai.embeddings import embed_texts, freelancer_embedding_text  # noqa: E402
from app.ai.ranking import default_weights  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.search_pipeline import run_search  # noqa: E402
from app.db.repositories.postgres import (  # noqa: E402
    FreelancerRepository,
    SkillRelationshipRepository,
    SkillRepository,
)
from app.db.session import async_session_factory, engine, init_postgres  # noqa: E402
from app.models.schemas import SearchRequest  # noqa: E402

FIXTURE = BACKEND_ROOT / "tests" / "fixtures" / "retrieval_eval.json"

# (label, retrieval mode, apply deterministic ranking?)
CONFIGS = [
    ("keyword only", "keyword", False),
    ("vector only", "vector", False),
    ("hybrid (RRF)", "hybrid", False),
    ("vector + ranking", "vector", True),
    ("hybrid + ranking", "hybrid", True),
]


async def _ensure_database() -> None:
    import asyncpg

    url = EVAL_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    base, name = url.rsplit("/", 1)
    conn = await asyncpg.connect(f"{base}/postgres")
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name):
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


async def load_corpus(profiles: list[dict]) -> dict[int, str]:
    """Rebuild the schema, insert profiles; return {freelancer id: archetype}."""
    await _ensure_database()
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await init_postgres()
    vectors = embed_texts(
        [
            freelancer_embedding_text(
                name=p["name"], bio=p["bio"], skills=p["skills"], location="Remote"
            )
            for p in profiles
        ]
    )
    archetypes: dict[int, str] = {}
    async with async_session_factory() as session:
        await SkillRepository(session).sync_taxonomy()
        repo = FreelancerRepository(session)
        for profile, vector in zip(profiles, vectors):
            freelancer = await repo.create(
                name=profile["name"],
                skills=profile["skills"],
                bio=profile["bio"],
                location="Remote",
                experience_years=profile["experience_years"],
                hourly_rate=profile["hourly_rate"],
                rating=profile["rating"],
                account_age_days=400,
                review_count=10,
                fraud_score=0.05,
                availability=True,
                portfolio_urls=[],
                embedding=vector,
            )
            archetypes[freelancer.id] = profile["archetype"]
        await session.commit()
    return archetypes


def dcg(gains: list[int]) -> float:
    return sum((2**g - 1) / math.log2(i + 2) for i, g in enumerate(gains))


def ndcg_at(ranked_gains: list[int], all_gains: list[int], k: int) -> float:
    ideal = dcg(sorted(all_gains, reverse=True)[:k])
    return dcg(ranked_gains[:k]) / ideal if ideal else 0.0


def recall_at(ranked_gains: list[int], total_relevant: int, k: int) -> float:
    if not total_relevant:
        return 0.0
    return sum(1 for g in ranked_gains[:k] if g > 0) / total_relevant


def mrr(ranked_gains: list[int]) -> float:
    for i, g in enumerate(ranked_gains, start=1):
        if g == 2:
            return 1.0 / i
    return 0.0


async def evaluate(queries: list[dict], archetypes: dict[int, str], weights, verbose: bool):
    results: dict[str, list[tuple[float, float, float]]] = {label: [] for label, _, _ in CONFIGS}
    for query in queries:
        relevant: dict[str, int] = query["relevant"]
        all_gains = [relevant.get(a, 0) for a in archetypes.values()]
        total_relevant = sum(1 for g in all_gains if g > 0)
        body = SearchRequest.model_validate(
            {
                "query": query["query"],
                "skills": query["skills"],
                "niceToHaveSkills": query["nice_to_have_skills"],
                "seniorityLevel": query["seniority_level"],
                "budget": query["budget"],
                "budgetType": query["budget_type"],
            }
        )
        line = []
        for label, mode, rank in CONFIGS:
            async with async_session_factory() as session:
                outcome = await run_search(
                    body,
                    FreelancerRepository(session),
                    SkillRelationshipRepository(session),
                    mode=mode,
                    weights=weights,
                )
            ids = (
                [r.candidate.id for r in outcome.ranked]
                if rank
                else [c.freelancer.id for c in outcome.retrieval.candidates]
            )
            gains = [relevant.get(archetypes[i], 0) for i in ids]
            scores = (
                ndcg_at(gains, all_gains, 10),
                recall_at(gains, total_relevant, 50),
                mrr(gains),
            )
            results[label].append(scores)
            line.append(f"{scores[0]:.2f}")
        if verbose:
            print(f"#{query['id']:>2} [{query['set']}] nDCG@10 " + " / ".join(line)
                  + f"  {query['query'][:60]}")
    return results


def report(results, n_queries: int, set_name: str) -> None:
    print(
        f"\nset={set_name}  queries={n_queries}  embeddings={settings.embedding_provider}"
        f" ({settings.embedding_model})"
    )
    print(f"{'config':<20} {'nDCG@10':>8} {'Recall@50':>10} {'MRR':>6}")
    for label, rows in results.items():
        means = [sum(col) / len(col) for col in zip(*rows)]
        print(f"{label:<20} {means[0]:>8.3f} {means[1]:>10.3f} {means[2]:>6.3f}")


def _parse_weights(pairs: list[str]):
    weights = default_weights()
    for pair in pairs:
        key, _, value = pair.partition("=")
        if key not in type(weights).model_fields:
            raise SystemExit(f"unknown weight {key!r}; one of {list(type(weights).model_fields)}")
        weights = weights.model_copy(update={key: float(value)})
    return weights


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--set", choices=["dev", "holdout", "all"], default="all")
    parser.add_argument("--weight", action="append", default=[], metavar="NAME=VALUE")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if settings.embedding_provider.lower() in {"hash", "test"}:
        print("warning: hash embeddings are not semantic; vector numbers are meaningless")
    data = json.loads(FIXTURE.read_text())
    queries = [q for q in data["queries"] if args.set == "all" or q["set"] == args.set]
    weights = _parse_weights(args.weight)
    archetypes = await load_corpus(data["profiles"])
    results = await evaluate(queries, archetypes, weights, args.verbose)
    report(results, len(queries), args.set)
    print("weights:", {k: round(v, 3) for k, v in weights.model_dump().items()})
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
