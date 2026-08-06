from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.dependencies import get_activity_repo, get_search_history_repo
from app.core.rate_limit import enforce_public_rate_limit
from app.db.repositories.mongo import ActivityLogRepository, SearchHistoryRepository
from app.models.schemas import (
    ActivityFeedItem,
    ActivityFeedResponse,
    RecentSearchItem,
    RecentSearchResponse,
)

router = APIRouter(dependencies=[Depends(enforce_public_rate_limit)])


def _relative_time(ts: datetime) -> str:
    now = datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    delta = now - ts
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return f"{max(seconds, 1)}s ago"
    if seconds < 3600:
        return f"{seconds // 60}m ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


def _endpoint_to_feed_type(endpoint: str) -> str:
    if endpoint == "/search":
        return "search"
    if endpoint == "/fraud":
        return "fraud"
    if endpoint == "/team-builder":
        return "team"
    if endpoint.startswith("/contracts"):
        return "contract"
    return "search"


def _endpoint_to_text(endpoint: str, payload: dict, summary: dict) -> str:
    if endpoint == "/search":
        query = payload.get("query") or ", ".join(payload.get("skills") or []) or "talent"
        count = summary.get(
            "result_count",
            summary.get("returned", summary.get("total_candidates", 0)),
        )
        return f'A* search for "{query}" returned {count} matches'
    if endpoint == "/fraud":
        name = summary.get("name") or payload.get("name") or "freelancer"
        score = summary.get("score", summary.get("fraud_score"))
        if score is not None:
            return f"Bayesian scan on {name}: {int(float(score) * 100)}% fraud probability"
        return f"Fraud analysis completed for {name}"
    if endpoint == "/team-builder":
        size = summary.get("team_size", len(summary.get("team_ids", [])))
        return f"CSP solver built a team of {size} member(s)"
    if endpoint.startswith("/contracts"):
        return "Contract assignment updated on project"
    return f"Activity on {endpoint}"


@router.get("/feed", response_model=ActivityFeedResponse)
async def get_activity_feed(
    limit: int = 20,
    activity_repo: ActivityLogRepository = Depends(get_activity_repo),
) -> ActivityFeedResponse:
    if limit < 1:
        limit = 1
    if limit > 50:
        limit = 50

    docs = await activity_repo.list_recent(limit=limit)
    items: list[ActivityFeedItem] = []
    for doc in docs:
        endpoint = doc.get("endpoint", "")
        ts = doc.get("timestamp")
        if not isinstance(ts, datetime):
            continue
        feed_type = _endpoint_to_feed_type(endpoint)
        items.append(
            ActivityFeedItem(
                id=str(doc.get("_id", "")),
                type=feed_type,
                text=_endpoint_to_text(
                    endpoint,
                    doc.get("payload") or {},
                    doc.get("response_summary") or {},
                ),
                time=_relative_time(ts),
            )
        )
    return ActivityFeedResponse(items=items)


@router.get("/searches/recent", response_model=RecentSearchResponse)
async def get_recent_searches(
    limit: int = 5,
    search_history_repo: SearchHistoryRepository = Depends(get_search_history_repo),
) -> RecentSearchResponse:
    if limit < 1:
        limit = 1
    if limit > 20:
        limit = 20

    docs = await search_history_repo.list_recent(limit=limit)
    searches: list[RecentSearchItem] = []
    for doc in docs:
        ts = doc.get("timestamp")
        if not isinstance(ts, datetime):
            continue
        query = doc.get("query") or ", ".join(doc.get("skills") or []) or "Search"
        searches.append(
            RecentSearchItem(
                query=query,
                results=int(doc.get("result_count", 0)),
                time=_relative_time(ts),
            )
        )
    return RecentSearchResponse(searches=searches)
