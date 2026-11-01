from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.activity import log_activity
from app.core.config import settings
from app.core.dependencies import get_db_session, require_admin
from app.core.rate_limit import enforce_user_action_rate_limit
from app.db.seed import DatabaseSeeder
from app.models.schemas import SeedRequest, SeedResponse

router = APIRouter(
    dependencies=[Depends(enforce_user_action_rate_limit), Depends(require_admin)]
)


@router.post("", response_model=SeedResponse)
async def seed_database(
    body: SeedRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SeedResponse:
    endpoint = "/seed"
    if not settings.seed_enabled:
        raise HTTPException(status_code=403, detail="Seeding is disabled")
    try:
        seeder = DatabaseSeeder(session)
        result = await seeder.run(
            freelancer_count=body.freelancer_count,
            reset=body.reset,
        )
        await seeder.rebuild_graph()

        response = SeedResponse(
            success=True,
            message="Database seeded successfully",
            freelancers_created=result.freelancers_created,
            projects_created=result.projects_created,
            contracts_created=result.contracts_created,
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
        raise HTTPException(status_code=500, detail="Seeding failed") from exc
