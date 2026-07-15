"""Latency benchmark for the /search pipeline (retrieval + ranking, no LLM).

Usage (from backend/):
  python -m scripts.bench_search                 # 10k profiles, 5 rounds of 20 queries
  python -m scripts.bench_search --profiles 2000 --rounds 3

Builds N profiles by recombining the eval corpus (skills and bio sentences mixed
across profiles), loads them into EVAL_DATABASE_URL (schema DROPPED and rebuilt) and
times scripts.eval_retrieval's queries end to end, query embedding included.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import time

from scripts.eval_retrieval import FIXTURE, load_corpus  # sets up the eval database env

from sqlalchemy import text  # noqa: E402

from app.core.search_pipeline import run_search  # noqa: E402
from app.db.repositories.postgres import (  # noqa: E402
    FreelancerRepository,
    SkillRelationshipRepository,
)
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.schemas import SearchRequest  # noqa: E402


def synthesize(profiles: list[dict], count: int, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    sentences = [s.strip() + "." for p in profiles for s in p["bio"].split(".") if s.strip()]
    out = []
    for i in range(count):
        base = profiles[i % len(profiles)]
        donor = rng.choice(profiles)
        skills = list(dict.fromkeys(base["skills"] + rng.sample(donor["skills"], 1)))
        bio = " ".join([base["bio"].split(".")[0] + ".", rng.choice(sentences)])
        out.append(
            {
                **base,
                "name": f"{base['name']} {i}",
                "skills": skills,
                "bio": bio,
                "hourly_rate": float(rng.randint(15, 150)),
                "experience_years": rng.randint(0, 15),
            }
        )
    return out


def _request(query: dict) -> SearchRequest:
    return SearchRequest.model_validate(
        {
            "query": query["query"],
            "skills": query["skills"],
            "niceToHaveSkills": query["nice_to_have_skills"],
            "seniorityLevel": query["seniority_level"],
            "budget": query["budget"],
            "budgetType": query["budget_type"],
        }
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--profiles", type=int, default=10_000)
    parser.add_argument("--rounds", type=int, default=5)
    args = parser.parse_args()

    data = json.loads(FIXTURE.read_text())
    started = time.perf_counter()
    await load_corpus(synthesize(data["profiles"], args.profiles))
    print(f"loaded {args.profiles} profiles in {time.perf_counter() - started:.0f}s")
    async with engine.begin() as conn:
        await conn.execute(text("ANALYZE freelancers"))

    requests = [_request(q) for q in data["queries"]]
    timings: list[float] = []
    for round_ in range(args.rounds + 1):  # round 0 warms caches and is discarded
        for body in requests:
            t0 = time.perf_counter()
            async with async_session_factory() as session:
                await run_search(
                    body, FreelancerRepository(session), SkillRelationshipRepository(session)
                )
            if round_:
                timings.append((time.perf_counter() - t0) * 1000)

    timings.sort()
    p95 = timings[int(0.95 * (len(timings) - 1))]
    print(
        f"{len(timings)} searches: p50 {statistics.median(timings):.0f} ms, "
        f"p95 {p95:.0f} ms, max {timings[-1]:.0f} ms"
    )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
