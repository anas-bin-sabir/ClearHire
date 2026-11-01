"""The one place ClearHire talks to a language model (Gemini or Claude).

``LLM_PROVIDER=auto`` picks Gemini when ``GEMINI_API_KEY`` is set, else Anthropic.

Every caller has a deterministic fallback, so failures surface as ``LLMUnavailable``
(logged with the request id) instead of propagating API exceptions into routers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Generic, Literal, TypeVar

import anthropic
import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)
Effort = Literal["low", "medium", "high"]

Provider = Literal["gemini", "claude"]

_client: anthropic.AsyncAnthropic | None = None
_gemini_http: httpx.AsyncClient | None = None

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class LLMUnavailable(Exception):
    """No key configured, the API failed, or the response was unusable."""


@dataclass
class LLMUsage:
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    request_id: str | None
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0

    def as_metadata(self) -> dict:
        return {
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_input_tokens": self.cache_read_input_tokens,
            "cache_creation_input_tokens": self.cache_creation_input_tokens,
            "latency_ms": self.latency_ms,
            "request_id": self.request_id,
        }


@dataclass
class LLMResult(Generic[T]):
    value: T
    usage: LLMUsage


def provider() -> Provider:
    """The provider calls go to. Also the ``source`` label on AI output."""
    choice = settings.llm_provider
    if choice == "auto":
        return "gemini" if settings.gemini_api_key else "claude"
    return "gemini" if choice == "gemini" else "claude"


def is_configured() -> bool:
    if provider() == "gemini":
        return bool(settings.gemini_api_key)
    return bool(settings.anthropic_api_key)


def active_model() -> str:
    return settings.gemini_model if provider() == "gemini" else settings.anthropic_model


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
        cache_read_input_tokens=getattr(message.usage, "cache_read_input_tokens", None) or 0,
        cache_creation_input_tokens=(
            getattr(message.usage, "cache_creation_input_tokens", None) or 0
        ),
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


async def _anthropic_parse(
    *,
    system: str,
    user: str,
    schema: type[T],
    effort: Effort = "low",
    max_tokens: int = 4000,
    cache_system: bool = False,
) -> LLMResult[T]:
    """Schema-validated structured output (Pydantic model) via ``messages.parse``.

    ``cache_system`` marks the system prompt as a prompt-cache breakpoint. Keep that
    prompt byte-stable; per-request data belongs in ``user``. Prefixes below the
    model's minimum (512 tokens on current models) are silently not cached.
    """
    client = get_client()
    started = time.monotonic()
    system_param = (
        [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        if cache_system
        else system
    )
    message = await _call(
        "parse",
        lambda: client.messages.parse(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system_param,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort},
            output_format=schema,
        ),
    )
    _check_stop(message)
    if message.parsed_output is None:
        raise LLMUnavailable("no parsed output")
    return LLMResult(value=message.parsed_output, usage=_usage(message, started))


async def _anthropic_complete(
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


# --- Gemini (REST generateContent) --------------------------------------------

_GEMINI_SCHEMA_KEYS = {
    "type", "format", "description", "enum", "items", "properties", "required",
    "nullable", "minItems", "maxItems", "minimum", "maximum",
}
_GEMINI_DECLINED = {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE"}


def gemini_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Convert a Pydantic JSON schema to Gemini's OpenAPI-subset ``responseSchema``:
    inline ``$ref``s, turn ``anyOf [X, null]`` into ``nullable``, drop unsupported keys
    and pin property order. The reply is still validated against the Pydantic model."""
    defs = schema.get("$defs", {})

    def convert(node: dict[str, Any]) -> dict[str, Any]:
        if "$ref" in node:
            target = defs[node["$ref"].rsplit("/", 1)[-1]]
            merged = {**target, **{k: v for k, v in node.items() if k != "$ref"}}
            return convert(merged)
        if "anyOf" in node:
            options = [o for o in node["anyOf"] if o.get("type") != "null"]
            nullable = len(options) < len(node["anyOf"])
            base = {k: v for k, v in node.items() if k != "anyOf"}
            if len(options) == 1:
                out = convert({**options[0], **base})
            else:
                out = {"anyOf": [convert(o) for o in options]}
                if "description" in base:
                    out["description"] = base["description"]
            if nullable:
                out["nullable"] = True
            return out
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key not in _GEMINI_SCHEMA_KEYS:
                continue
            if key == "properties":
                out[key] = {name: convert(sub) for name, sub in value.items()}
                out["propertyOrdering"] = list(value)
            elif key == "items":
                out[key] = convert(value)
            else:
                out[key] = value
        if "enum" in out and "type" not in out:
            out["type"] = "string"
        return out

    return convert(schema)


def _gemini_client() -> httpx.AsyncClient:
    global _gemini_http
    if not settings.gemini_api_key:
        raise LLMUnavailable("GEMINI_API_KEY is not set")
    if _gemini_http is None:
        _gemini_http = httpx.AsyncClient(
            base_url=GEMINI_BASE_URL, timeout=settings.gemini_timeout_seconds
        )
    return _gemini_http


async def _gemini_generate(kind: str, body: dict[str, Any]) -> dict[str, Any]:
    """POST generateContent with two retries on 5xx/connection errors. The key goes in
    a header, never the URL, so it doesn't end up in logs."""
    client = _gemini_client()
    path = f"/models/{settings.gemini_model}:generateContent"
    headers = {"x-goog-api-key": settings.gemini_api_key}
    for attempt in range(3):
        try:
            response = await client.post(path, json=body, headers=headers)
        except httpx.TransportError as exc:
            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            logger.warning("gemini %s connection error: %s", kind, exc)
            raise LLMUnavailable("connection error") from exc
        if response.status_code >= 500 and attempt < 2:
            await asyncio.sleep(0.5 * (attempt + 1))
            continue
        if response.status_code == 429:
            logger.warning("gemini %s rate limited", kind)
            raise LLMUnavailable("rate limited")
        if response.status_code >= 400:
            try:
                detail = response.json().get("error", {}).get("message", "")
            except ValueError:
                detail = response.text[:200]
            logger.warning("gemini %s failed: %s %s", kind, response.status_code, detail)
            raise LLMUnavailable(f"API error {response.status_code}")
        return response.json()
    raise LLMUnavailable("API error")  # unreachable: the loop returns or raises


def _gemini_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason")
        raise LLMUnavailable(f"model declined (category={reason})")
    candidate = candidates[0]
    finish = candidate.get("finishReason")
    if finish == "MAX_TOKENS":
        raise LLMUnavailable("response truncated at max_tokens")
    if finish in _GEMINI_DECLINED:
        raise LLMUnavailable(f"model declined (category={finish})")
    parts = (candidate.get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()


def _gemini_usage(data: dict[str, Any], started: float) -> LLMUsage:
    meta = data.get("usageMetadata") or {}
    return LLMUsage(
        model=data.get("modelVersion") or settings.gemini_model,
        input_tokens=meta.get("promptTokenCount", 0),
        output_tokens=meta.get("candidatesTokenCount", 0) + meta.get("thoughtsTokenCount", 0),
        latency_ms=int((time.monotonic() - started) * 1000),
        request_id=data.get("responseId"),
        cache_read_input_tokens=meta.get("cachedContentTokenCount", 0),
    )


def _gemini_body(system: str, user: str, max_tokens: int, **generation: Any) -> dict[str, Any]:
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens + settings.gemini_thinking_headroom,
            **generation,
        },
    }


def _strip_fence(text: str) -> str:
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    return text.strip()


async def _gemini_parse(*, system: str, user: str, schema: type[T], max_tokens: int) -> LLMResult[T]:
    started = time.monotonic()
    json_schema = schema.model_json_schema()
    try:
        data = await _gemini_generate(
            "parse",
            _gemini_body(
                system, user, max_tokens,
                responseMimeType="application/json",
                responseSchema=gemini_schema(json_schema),
            ),
        )
    except LLMUnavailable as exc:
        if str(exc) != "API error 400":
            raise
        # The model rejected the converted schema: ask for JSON with the schema in the
        # prompt instead. Validation below is the same either way.
        logger.info("gemini rejected responseSchema; retrying with the schema in the prompt")
        data = await _gemini_generate(
            "parse",
            _gemini_body(
                f"{system}\n\nReply with only a JSON object matching this JSON Schema:\n"
                f"{json.dumps(json_schema)}",
                user, max_tokens,
                responseMimeType="application/json",
            ),
        )
    text = _strip_fence(_gemini_text(data))
    if not text:
        raise LLMUnavailable("no parsed output")
    try:
        value = schema.model_validate_json(text)
    except ValidationError as exc:
        logger.warning("gemini parse returned JSON that doesn't match %s", schema.__name__)
        raise LLMUnavailable("no parsed output") from exc
    return LLMResult(value=value, usage=_gemini_usage(data, started))


async def _gemini_complete(*, system: str, user: str, max_tokens: int) -> LLMResult[str]:
    started = time.monotonic()
    data = await _gemini_generate("complete", _gemini_body(system, user, max_tokens))
    text = _gemini_text(data)
    if not text:
        raise LLMUnavailable("empty response")
    return LLMResult(value=text, usage=_gemini_usage(data, started))


# --- Public API ----------------------------------------------------------------


async def parse(
    *,
    system: str,
    user: str,
    schema: type[T],
    effort: Effort = "low",
    max_tokens: int = 4000,
    cache_system: bool = False,
) -> LLMResult[T]:
    """Schema-validated structured output as an instance of ``schema``.

    ``effort`` and ``cache_system`` apply to Claude only (Gemini caches implicitly).
    """
    if provider() == "gemini":
        return await _gemini_parse(system=system, user=user, schema=schema, max_tokens=max_tokens)
    return await _anthropic_parse(
        system=system, user=user, schema=schema, effort=effort,
        max_tokens=max_tokens, cache_system=cache_system,
    )


async def complete(
    *,
    system: str,
    user: str,
    effort: Effort = "low",
    max_tokens: int = 2000,
) -> LLMResult[str]:
    """Plain text completion."""
    if provider() == "gemini":
        return await _gemini_complete(system=system, user=user, max_tokens=max_tokens)
    return await _anthropic_complete(system=system, user=user, effort=effort, max_tokens=max_tokens)
