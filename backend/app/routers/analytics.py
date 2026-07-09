from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from app.core.dependencies import get_activity_repo
from app.core.rate_limit import enforce_public_rate_limit
from app.db.repositories.postgres import ActivityLogRepository
from app.models.schemas import DayMetrics, TimeSeriesResponse

router = APIRouter(dependencies=[Depends(enforce_public_rate_limit)])


async def _get_metrics_for_date(
    repo: ActivityLogRepository, date: datetime, endpoint_filter: str = None
) -> dict[str, Any]:
    """Get activity counts for a specific date."""
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)

    searches_count = await repo.count_by_window(
        endpoint="/search",
        start=start_of_day,
        end=end_of_day,
        status="success",
    )
    teams_count = await repo.count_by_window(
        endpoint="/team-builder",
        start=start_of_day,
        end=end_of_day,
        status="success",
    )
    fraud_count = await repo.count_by_window(
        endpoint="/fraud",
        start=start_of_day,
        end=end_of_day,
        status="success",
    )

    return {
        "searches": searches_count,
        "teams": teams_count,
        "fraud": fraud_count,
    }


@router.get("", response_model=TimeSeriesResponse)
async def get_analytics_timeseries(
    days: int = 7,
    activity_repo: ActivityLogRepository = Depends(get_activity_repo),
) -> TimeSeriesResponse:
    """Get activity time-series data for last N days (default 7)"""
    if days < 1:
        days = 7
    if days > 90:
        days = 90

    data = []
    now = datetime.now(timezone.utc)
    day_labels = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ]

    total_searches = 0
    total_teams = 0
    total_fraud = 0

    for i in range(days - 1, -1, -1):
        current_date = now - timedelta(days=i)
        metrics = await _get_metrics_for_date(activity_repo, current_date)

        label = day_labels[current_date.weekday()]
        dm = DayMetrics(
            label=label,
            searches=metrics["searches"],
            teams=metrics["teams"],
            fraud=metrics["fraud"],
        )
        data.append(dm)

        total_searches += metrics["searches"]
        total_teams += metrics["teams"]
        total_fraud += metrics["fraud"]

    return TimeSeriesResponse(
        data=data,
        total_searches=total_searches,
        total_teams=total_teams,
        total_fraud=total_fraud,
        period=f"last_{days}_days",
    )
