from types import SimpleNamespace

import anthropic
import httpx
import pytest
from sqlalchemy import select

from app.ai import llm
from app.ai.project_parser import ParsedBrief, ParsedSkill
from app.core.config import settings
from app.db.repositories.postgres import SkillRepository
from app.db.session import async_session_factory
from app.models.orm import AIExplanation

BRIEF = (
    "We need an MVP built in 6 weeks for an AI healthcare startup under $15k. "
    "Stack: ReactJS, FastAPI and Postgres, plus HIPAA experience. Team of 3 senior devs. "
    "Docker is a nice to have."
)


# --- Fake Anthropic client -------------------------------------------------


class _FakeMessages:
    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.calls: list[dict] = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        return self.behaviour(kwargs)

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.behaviour(kwargs)


def _message(parsed=None, stop_reason="end_turn", text=None):
    content = [SimpleNamespace(type="text", text=text)] if text else []
    return SimpleNamespace(
        parsed_output=parsed,
        stop_reason=stop_reason,
        stop_details=SimpleNamespace(category="cyber") if stop_reason == "refusal" else None,
        model="claude-haiku-5-5",
        usage=SimpleNamespace(input_tokens=1200, output_tokens=300),
        content=content,
        _request_id="req_test123",
    )


@pytest.fixture
def fake_claude(monkeypatch):
    """Install a fake SDK client; returns a setter for the per-call behaviour."""
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    holder = {}

    def install(behaviour):
        messages = _FakeMessages(behaviour)
        monkeypatch.setattr(llm, "_client", SimpleNamespace(messages=messages))
        holder["messages"] = messages
        return messages

    return install


def _api_error(status: int):
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status, request=request, headers={"request-id": "req_err"})
    return anthropic.APIStatusError("boom", response=response, body=None)


# --- llm module --------------------------------------------------------------


async def test_parse_returns_value_and_usage(fake_claude):
    brief = ParsedBrief(
        title="t", summary="s", skills=[], budget_amount=None, budget_type=None,
        deadline_days=None, team_size=None, seniority_level=None, domain=None,
        compliance=[], implicit_constraints=[], ambiguities=[],
    )
    messages = fake_claude(lambda kw: _message(parsed=brief))
    result = await llm.parse(system="sys", user="u", schema=ParsedBrief)
    assert result.value is brief
    assert result.usage.as_metadata() == {
        "model": "claude-haiku-5-5", "input_tokens": 1200, "output_tokens": 300,
        "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
        "latency_ms": result.usage.latency_ms, "request_id": "req_test123",
    }
    call = messages.calls[0]
    assert call["output_format"] is ParsedBrief
    assert call["output_config"] == {"effort": "low"}
    assert "temperature" not in call  # rejected by current models


@pytest.mark.parametrize(
    "behaviour, reason",
    [
        (lambda kw: _message(stop_reason="refusal"), "declined"),
        (lambda kw: _message(stop_reason="max_tokens"), "truncated"),
        (lambda kw: _message(parsed=None), "no parsed output"),
    ],
)
async def test_parse_unusable_responses_raise_unavailable(fake_claude, behaviour, reason):
    fake_claude(behaviour)
    with pytest.raises(llm.LLMUnavailable, match=reason):
        await llm.parse(system="s", user="u", schema=ParsedBrief)


async def test_api_errors_become_unavailable(fake_claude):
    def boom(kw):
        raise _api_error(529)

    fake_claude(boom)
    with pytest.raises(llm.LLMUnavailable, match="529"):
        await llm.complete(system="s", user="u")


async def test_no_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm, "_client", None)
    with pytest.raises(llm.LLMUnavailable):
        await llm.complete(system="s", user="u")


# --- Grounding ---------------------------------------------------------------


async def test_grounding_alias_exact_semantic_and_unknown():
    async with async_session_factory() as session:
        repo = SkillRepository(session)
        grounded = await repo.ground(
            [
                ("ReactJS", "must"),
                ("FastAPI", "must"),
                # Hash embeddings only match identical text: reuse Kafka's embedding text.
                ("Kafka (Data & AI): apache kafka, event streaming", "nice"),
                ("Underwater basket weaving", "must"),
                ("react", "nice"),  # duplicate of React: the "must" wins
            ]
        )
    by_input = {g.input: g for g in grounded}
    assert by_input["ReactJS"].canonical == "React" and by_input["ReactJS"].match == "alias"
    assert by_input["ReactJS"].importance == "must"
    assert by_input["FastAPI"].match == "exact" and by_input["FastAPI"].confidence == 1.0
    kafka = by_input["Kafka (Data & AI): apache kafka, event streaming"]
    assert kafka.canonical == "Kafka" and kafka.match == "semantic"
    unknown = by_input["Underwater basket weaving"]
    assert unknown.canonical is None and unknown.match == "none"
    assert len(grounded) == 4


# --- /projects/extract -------------------------------------------------------


async def test_extract_deterministic_fallback(client, make_user):
    _, headers = await make_user("client")
    assert (await client.post("/projects/extract", json={"text": BRIEF})).status_code == 401

    response = await client.post("/projects/extract", json={"text": BRIEF}, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "deterministic"
    skills = {s["canonical"]: s for s in body["skills"]}
    assert {"React", "FastAPI", "PostgreSQL", "HIPAA Compliance", "Docker"} <= set(skills)
    assert skills["React"]["match"] == "alias"
    assert skills["Docker"]["importance"] == "nice"
    assert skills["React"]["importance"] == "must"
    assert body["budget"] == 15000 and body["budget_type"] == "fixed"
    assert body["deadline_days"] == 42
    assert body["team_size"] == 3
    assert body["seniority_level"] == "senior"
    assert body["domain"] == "Healthcare"
    assert body["compliance"] == ["HIPAA"]
    assert body["ambiguities"] == []

    async with async_session_factory() as session:
        row = (await session.execute(select(AIExplanation))).scalar_one()
    assert row.pipeline == "project_extraction" and row.model == "deterministic"
    assert row.metadata_json["fallback_reason"] == "ANTHROPIC_API_KEY is not set"


async def test_extract_reports_missing_facts(client, make_user):
    _, headers = await make_user("client")
    response = await client.post(
        "/projects/extract",
        json={"text": "Help us improve our internal tooling, details to follow."},
        headers=headers,
    )
    ambiguities = " ".join(response.json()["ambiguities"])
    for fact in ("Budget", "Deadline", "Team size", "skills"):
        assert fact in ambiguities


async def test_extract_with_claude_grounds_and_records_usage(client, make_user, fake_claude):
    _, headers = await make_user("client")
    parsed = ParsedBrief(
        title="Healthcare MVP",
        summary="Build an MVP.",
        skills=[
            ParsedSkill(name="ReactJS", importance="must"),
            ParsedSkill(name="postgres", importance="must"),
            ParsedSkill(name="Quantum knitting", importance="nice"),
        ],
        budget_amount=None,
        budget_type=None,
        deadline_days=42,
        team_size=3,
        seniority_level="senior",
        domain="Healthcare",
        compliance=["HIPAA"],
        implicit_constraints=["Overlap with EST hours"],
        ambiguities=["Is the $15k for design too?"],
    )
    messages = fake_claude(lambda kw: _message(parsed=parsed))

    response = await client.post("/projects/extract", json={"text": BRIEF}, headers=headers)
    body = response.json()
    assert body["source"] == "claude"
    assert [s["canonical"] for s in body["skills"]] == ["React", "PostgreSQL", None]
    assert body["budget"] is None
    assert "Is the $15k for design too?" in body["ambiguities"]
    assert any("Budget" in a for a in body["ambiguities"])
    assert any("Quantum knitting" in a for a in body["ambiguities"])
    # The brief is passed as delimited data and the taxonomy is in the system prompt.
    call = messages.calls[0]
    assert "<brief>" in call["messages"][0]["content"] and "PostgreSQL" in call["system"]

    async with async_session_factory() as session:
        row = (await session.execute(select(AIExplanation))).scalar_one()
    assert row.model == "claude-haiku-5-5"
    assert row.metadata_json["usage"]["output_tokens"] == 300


async def test_extract_falls_back_when_claude_fails(client, make_user, fake_claude):
    _, headers = await make_user("client")

    def boom(kw):
        raise _api_error(500)

    fake_claude(boom)
    body = (await client.post("/projects/extract", json={"text": BRIEF}, headers=headers)).json()
    assert body["source"] == "deterministic"
    assert body["budget"] == 15000


# --- Canonical skills on write and read --------------------------------------


async def test_skills_are_canonicalized_everywhere(client, make_user, make_freelancer):
    freelancer = await make_freelancer(skills=["ML", "postgres", "Machine Learning"])
    assert freelancer.skills == ["Machine Learning", "PostgreSQL"]

    response = await client.post("/search", json={"skills": ["postgres"]})
    assert [f["id"] for f in response.json()["freelancers"]] == [freelancer.id]

    _, headers = await make_user("client")
    created = await client.post(
        "/projects",
        json={
            "title": "Data platform",
            "budget": 9000,
            "required_skills": ["py", "k8s"],
            "nice_to_have_skills": ["Kubernetes", "dbt"],
            "domain": "FinTech",
            "compliance": ["SOC 2"],
            "budget_type": "fixed",
        },
        headers=headers,
    )
    project = created.json()["project"]
    assert project["required_skills"] == ["Python", "Kubernetes"]
    assert project["nice_to_have_skills"] == ["dbt"]  # already required → dropped
    assert project["domain"] == "FinTech" and project["compliance"] == ["SOC 2"]


async def test_skill_list_is_the_taxonomy(client):
    skills = (await client.get("/freelancers/skills/list")).json()["skills"]
    assert "PostgreSQL" in skills and "postgres" not in skills
    assert len(skills) >= 140
