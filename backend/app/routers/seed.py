from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.activity import log_activity
from app.core.dependencies import get_db_session
from app.core.rate_limit import enforce_user_action_rate_limit
from app.db.seed import DatabaseSeeder
from app.models.schemas import SeedRequest, SeedResponse

router = APIRouter(dependencies=[Depends(enforce_user_action_rate_limit)])


@router.post("", response_model=SeedResponse)
async def seed_database(
    body: SeedRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SeedResponse:
    endpoint = "/seed"
    try:
        seeder = DatabaseSeeder(session)
        result = await seeder.run(
            freelancer_count=body.freelancer_count,
            reset=body.reset,
            sync_neo4j=True,
        )

        response = SeedResponse(
            success=True,
            message="Database seeded successfully",
            freelancers_created=result.freelancers_created,
            projects_created=result.projects_created,
            contracts_created=result.contracts_created,
            neo4j_synced=result.neo4j_synced,
        )

        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(),
            response_summary=response.model_dump(),
        )
        return response
    except Exception as exc:
        await log_activity(
            endpoint=endpoint,
            method="POST",
            payload=body.model_dump(),
            status="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc
