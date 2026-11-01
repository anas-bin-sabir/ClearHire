"""Gemini path of app.ai.llm, against a mocked generateContent endpoint."""

import json

import httpx
import pytest

from app.ai import llm
from app.ai.project_parser import ParsedBrief
from app.ai.rerank import LLMRerankOutput
from app.core.config import settings

BRIEF_JSON = {
    "title": "Claims triage", "summary": "Classify claims.",
    "skills": [{"name": "Python", "importance": "must"}],
    "budget_amount": 15000, "budget_type": "fixed", "deadline_days": 42, "team_size": 3,
    "seniority_level": "senior", "domain": "insurance",
    "compliance": [], "implicit_constraints": [], "ambiguities": [],
}


def _reply(text: str, finish: str = "STOP", **extra) -> dict:
    return {
        "candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": finish}],
        "usageMetadata": {"promptTokenCount": 900, "candidatesTokenCount": 120, "thoughtsTokenCount": 30},
        "modelVersion": "gemini-3.5-flash-lite",
        "responseId": "resp_1",
        **extra,
    }


@pytest.fixture
def gemini(monkeypatch):
    """Route llm calls to a mock Gemini endpoint; returns (set_handler, requests)."""
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "gemini_api_key", "g-test-key")
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    requests: list[httpx.Request] = []
    state = {"handler": lambda req: httpx.Response(200, json=_reply("hi"))}

    def transport(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return state["handler"](request)

    client = httpx.AsyncClient(base_url=llm.GEMINI_BASE_URL, transport=httpx.MockTransport(transport))
    monkeypatch.setattr(llm, "_gemini_http", client)
    monkeypatch.setattr(llm.asyncio, "sleep", _no_sleep)

    def set_handler(handler):
        state["handler"] = handler

    return set_handler, requests


async def _no_sleep(_seconds):
    return None


def test_auto_provider_prefers_gemini_key(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "a")
    assert llm.provider() == "claude"
    monkeypatch.setattr(settings, "gemini_api_key", "g")
    assert llm.provider() == "gemini"
    assert llm.active_model() == settings.gemini_model


async def test_parse_sends_schema_and_validates(gemini):
    set_handler, requests = gemini
    set_handler(lambda req: httpx.Response(200, json=_reply(json.dumps(BRIEF_JSON))))
    result = await llm.parse(system="sys", user="brief", schema=ParsedBrief)
    assert result.value.title == "Claims triage"
    assert result.value.skills[0].name == "Python"
    assert result.usage.input_tokens == 900 and result.usage.output_tokens == 150
    assert result.usage.request_id == "resp_1"

    req = requests[0]
    assert req.url.path.endswith(f"/models/{settings.gemini_model}:generateContent")
    assert req.headers["x-goog-api-key"] == "g-test-key"
    assert "key=" not in str(req.url)
    body = json.loads(req.content)
    assert body["systemInstruction"]["parts"][0]["text"] == "sys"
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    assert config["responseSchema"]["properties"]["budget_amount"]["nullable"] is True
    assert "$defs" not in json.dumps(config["responseSchema"])


def test_schema_conversion_inlines_refs_and_nullables():
    schema = llm.gemini_schema(LLMRerankOutput.model_json_schema())
    dumped = json.dumps(schema)
    assert "$ref" not in dumped and "$defs" not in dumped and "anyOf" not in dumped
    judgement = schema["properties"]["judgements"]["items"]
    assert judgement["properties"]["biggest_gap"] == {"type": "string", "nullable": True}
    assert judgement["properties"]["strengths"]["items"]["required"] == ["text", "evidence"]
    assert schema["propertyOrdering"] == ["judgements", "comparisons"]


async def test_schema_rejected_falls_back_to_prompted_json(gemini):
    set_handler, requests = gemini

    def handler(req):
        body = json.loads(req.content)
        if "responseSchema" in body["generationConfig"]:
            return httpx.Response(400, json={"error": {"message": "bad schema"}})
        return httpx.Response(200, json=_reply("```json\n" + json.dumps(BRIEF_JSON) + "\n```"))

    set_handler(handler)
    result = await llm.parse(system="sys", user="brief", schema=ParsedBrief)
    assert result.value.team_size == 3
    assert len(requests) == 2
    assert "JSON Schema" in json.loads(requests[1].content)["systemInstruction"]["parts"][0]["text"]


@pytest.mark.parametrize(
    "reply, reason",
    [
        (_reply("", finish="MAX_TOKENS"), "truncated"),
        (_reply("", finish="SAFETY"), "declined"),
        ({"promptFeedback": {"blockReason": "SAFETY"}}, "declined"),
        (_reply('{"title": 1}'), "no parsed output"),
    ],
)
async def test_unusable_replies_raise_unavailable(gemini, reply, reason):
    set_handler, _ = gemini
    set_handler(lambda req: httpx.Response(200, json=reply))
    with pytest.raises(llm.LLMUnavailable, match=reason):
        await llm.parse(system="s", user="u", schema=ParsedBrief)


async def test_rate_limit_is_unavailable_without_retry(gemini):
    set_handler, requests = gemini
    set_handler(lambda req: httpx.Response(429, json={"error": {"message": "quota"}}))
    with pytest.raises(llm.LLMUnavailable, match="rate limited"):
        await llm.complete(system="s", user="u")
    assert len(requests) == 1


async def test_server_errors_are_retried(gemini):
    set_handler, requests = gemini
    replies = iter([httpx.Response(503), httpx.Response(200, json=_reply("Fine."))])
    set_handler(lambda req: next(replies))
    result = await llm.complete(system="s", user="u")
    assert result.value == "Fine."
    assert len(requests) == 2


async def test_thought_parts_are_ignored(gemini):
    set_handler, _ = gemini
    reply = _reply("answer")
    reply["candidates"][0]["content"]["parts"].insert(0, {"text": "thinking...", "thought": True})
    set_handler(lambda req: httpx.Response(200, json=reply))
    assert (await llm.complete(system="s", user="u")).value == "answer"


async def test_missing_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(llm.LLMUnavailable):
        await llm.complete(system="s", user="u")
