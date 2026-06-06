"""
ClearHire In-Process Event Bus

Architecture: lightweight asyncio pub/sub with no external dependencies.
Agents subscribe via @on() decorator. emit() fires handlers as background
asyncio tasks — the HTTP response returns immediately while agents run.

Known limitation: single-process only. No retry on failure. No persistence.
Production upgrade path: replace emit() internals with Arq task queue backed
by Redis. The @on() API stays identical — zero changes to agent code needed.
"""
import asyncio
import logging
from collections import defaultdict
from enum import Enum
from typing import Any, Callable

logger = logging.getLogger(__name__)


class ClearHireEvent(str, Enum):
    FREELANCER_CREATED    = "freelancer.created"
    FREELANCER_UPDATED    = "freelancer.updated"
    PROJECT_CREATED       = "project.created"
    TEAM_BUILD_REQUESTED  = "team.build_requested"


_handlers: dict[str, list[Callable]] = defaultdict(list)


def on(event: ClearHireEvent):
    """
    Decorator — registers an async handler for a ClearHire event.
    Handler is called with a single dict payload argument.
    """
    def decorator(fn: Callable):
        _handlers[event.value].append(fn)
        logger.debug(f"[EventBus] {fn.__name__} registered for '{event.value}'")
        return fn
    return decorator


async def emit(event: ClearHireEvent, payload: dict[str, Any]) -> None:
    """
    Publish an event. All registered handlers run concurrently as
    asyncio background tasks. Caller does not wait — response returns
    to client while agents process in background.

    Each handler is wrapped in _safe_run so one agent crash never
    silences or blocks other handlers.
    """
    handlers = _handlers.get(event.value, [])
    if not handlers:
        logger.debug(f"[EventBus] No handlers for '{event.value}' — skipping")
        return
    for handler in handlers:
        asyncio.create_task(
            _safe_run(handler, payload, event.value),
            name=f"agent_{handler.__name__}_{event.value}",
        )


async def _safe_run(
    handler: Callable,
    payload: dict[str, Any],
    event_name: str,
) -> None:
    """Isolate handler exceptions so one failure never affects others."""
    try:
        await handler(payload)
    except Exception as exc:
        logger.error(
            f"[EventBus] '{handler.__name__}' failed for '{event_name}': "
            f"{type(exc).__name__}: {exc}",
            exc_info=True,
        )
