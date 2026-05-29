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

from app.db.mongodb import close_mongodb, init_mongodb
from app.db.neo4j_client import close_neo4j, init_neo4j
from app.db.seed import DatabaseSeeder
from app.db.session import async_session_factory, close_postgres, init_postgres


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ClearHire databases")
    parser.add_argument("--count", type=int, default=50, help="Number of freelancers")
    parser.add_argument("--reset", action="store_true", help="Clear data before seeding")
    parser.add_argument("--no-neo4j", action="store_true", help="Skip Neo4j sync")
    args = parser.parse_args()

    await init_postgres()
    await init_mongodb()
    neo4j_ok = False
    if not args.no_neo4j:
        try:
            await init_neo4j()
            neo4j_ok = True
        except Exception as exc:
            print(f"Neo4j unavailable, skipping graph sync: {exc}")

    async with async_session_factory() as session:
        seeder = DatabaseSeeder(session)
        result = await seeder.run(
            freelancer_count=args.count,
            reset=args.reset,
            sync_neo4j=neo4j_ok,
        )
        await session.commit()

    print(
        f"Seeded {result.freelancers_created} freelancers, "
        f"{result.projects_created} project(s), "
        f"{result.contracts_created} contract(s). "
        f"Neo4j synced: {result.neo4j_synced}"
    )

    if neo4j_ok:
        await close_neo4j()
    await close_mongodb()
    await close_postgres()


if __name__ == "__main__":
    asyncio.run(main())
