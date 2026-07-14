"""The one place ClearHire talks to Claude.

Every caller has a deterministic fallback, so failures surface as ``LLMUnavailable``
(logged with the request id) instead of propagating API exceptions into routers.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Generic, Literal, TypeVar

import anthropic
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)
Effort = Literal["low", "medium", "high"]

_client: anthropic.AsyncAnthropic | None = None


class LLMUnavailable(Exception):
    """No key configured, the API failed, or the response was unusable."""


@dataclass
class LLMUsage:
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    request_id: str | None

    def as_metadata(self) -> dict:
        return {
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "latency_ms": self.latency_ms,
            "request_id": self.request_id,
        }


@dataclass
class LLMResult(Generic[T]):
    value: T
    usage: LLMUsage


def is_configured() -> bool:
    return bool(settings.anthropic_api_key)


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if not is_configured():
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set")
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=settings.anthropic_timeout_seconds,
            max_retries=2,
        )
    return _client


def _usage(message, started: float) -> LLMUsage:
    return LLMUsage(
        model=message.model,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        latency_ms=int((time.monotonic() - started) * 1000),
        request_id=getattr(message, "_request_id", None),
    )


def _check_stop(message) -> None:
    if message.stop_reason == "refusal":
        details = getattr(message, "stop_details", None)
        raise LLMUnavailable(f"model declined (category={getattr(details, 'category', None)})")
    if message.stop_reason == "max_tokens":
        raise LLMUnavailable("response truncated at max_tokens")


async def _call(kind: str, coro_factory):
    """Run one SDK call, translating SDK errors into LLMUnavailable."""
    try:
        return await coro_factory()
    except anthropic.RateLimitError as exc:
        logger.warning("claude %s rate limited (request_id=%s)", kind, exc.request_id)
        raise LLMUnavailable("rate limited") from exc
    except anthropic.APIStatusError as exc:
        logger.warning(
            "claude %s failed: %s %s (request_id=%s)",
            kind, exc.status_code, exc.message, exc.request_id,
        )
        raise LLMUnavailable(f"API error {exc.status_code}") from exc
    except anthropic.APIConnectionError as exc:
        logger.warning("claude %s connection error: %s", kind, exc)
        raise LLMUnavailable("connection error") from exc


async def parse(
    *,
    system: str,
    user: str,
    schema: type[T],
    effort: Effort = "low",
    max_tokens: int = 4000,
) -> LLMResult[T]:
    """Schema-validated structured output (Pydantic model) via ``messages.parse``."""
    client = get_client()
    started = time.monotonic()
    message = await _call(
        "parse",
        lambda: client.messages.parse(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort},
            output_format=schema,
        ),
    )
    _check_stop(message)
    if message.parsed_output is None:
        raise LLMUnavailable("no parsed output")
    return LLMResult(value=message.parsed_output, usage=_usage(message, started))


async def complete(
    *,
    system: str,
    user: str,
    effort: Effort = "low",
    max_tokens: int = 2000,
) -> LLMResult[str]:
    """Plain text completion."""
    client = get_client()
    started = time.monotonic()
    message = await _call(
        "complete",
        lambda: client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort},
        ),
    )
    _check_stop(message)
    text = "".join(block.text for block in message.content if block.type == "text").strip()
    if not text:
        raise LLMUnavailable("empty response")
    return LLMResult(value=text, usage=_usage(message, started))
