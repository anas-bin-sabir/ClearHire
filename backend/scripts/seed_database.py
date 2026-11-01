"""
CLI seed script for ClearHire databases.

Usage (from backend/):
  python -m scripts.seed_database
  python -m scripts.seed_database --count 100 --reset
"""

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.seed import DatabaseSeeder
from app.db.session import async_session_factory, close_postgres, init_postgres


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ClearHire databases")
    parser.add_argument("--count", type=int, default=50, help="Number of freelancers")
    parser.add_argument("--reset", action="store_true", help="Clear data before seeding")
    args = parser.parse_args()

    await init_postgres()

    async with async_session_factory() as session:
        seeder = DatabaseSeeder(session)
        result = await seeder.run(
            freelancer_count=args.count,
            reset=args.reset,
        )
        await session.commit()
        graph_rebuilt = await seeder.rebuild_graph()

    print(
        f"Seeded {result.freelancers_created} freelancers, "
        f"{result.projects_created} project(s), "
        f"{result.contracts_created} contract(s). "
        + ("Neo4j graph rebuilt." if graph_rebuilt else "Neo4j graph not rebuilt (disabled or unreachable).")
    )
    from app.graph.driver import close_driver

    await close_driver()
    await close_postgres()


if __name__ == "__main__":
    asyncio.run(main())
