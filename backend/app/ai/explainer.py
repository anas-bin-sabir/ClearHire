"""Claude explainer with deterministic structured fallbacks."""

from app.ai.types import (
    ConfidenceLevel,
    FraudAssessment,
    FraudExplanationInput,
    SearchExplanationInput,
    StructuredExplanation,
    TeamBuilderConstraints,
    TeamBuilderResult,
    TeamExplanationInput,
)
from app.ai import llm

SEARCH_SYSTEM = (
    "You are ClearHire matching intelligence. Respond in under 120 words. "
    "Use exactly: one summary sentence, then 3 bullet points covering skills, "
    "budget fit, and trust. No markdown headers."
)

FRAUD_SYSTEM = (
    "You are ClearHire fraud intelligence. Respond in under 100 words. "
    "Use exactly: one risk summary sentence, then bullets for each active signal. "
    "Be factual; do not speculate beyond provided scores."
)

TEAM_SYSTEM = (
    "You are ClearHire team optimization intelligence. Respond in under 120 words. "
    "Use exactly: one summary sentence, then bullets for skill coverage, budget, "
    "and member synergies. No markdown headers."
)


def _deterministic_search_explanation(data: SearchExplanationInput) -> StructuredExplanation:
    bullets: list[str] = []
    if data.required_skills:
        bullets.append(
            f"Required skills ({', '.join(data.required_skills)}) drive primary ranking."
        )
    else:
        bullets.append("No mandatory skills; ranking uses trust, budget fit, and embeddings.")

    bullets.append(
        f"Budget ${data.budget:,.0f} for team size {data.team_size} penalizes rate overruns."
    )

    if data.top_matches:
        top = data.top_matches[0]
        bullets.append(
            f"Top match {top.candidate.name}: match_score {top.match_score} "
            f"(skill gap {top.breakdown.skill_gap}, fraud {top.breakdown.fraud_penalty})."
        )
    else:
        bullets.append("No candidates met all constraints after filtering.")

    summary = (
        f"Ranked {len(data.top_matches)} matches for query "
        f"\"{data.query or 'general search'}\" using semantic retrieval and constraint ranking."
    )
    return StructuredExplanation(
        summary=summary,
        bullets=bullets[:3],
        confidence=ConfidenceLevel.HIGH if data.top_matches else ConfidenceLevel.LOW,
        source="deterministic",
    )


def _deterministic_fraud_explanation(data: FraudExplanationInput) -> StructuredExplanation:
    assessment = data.assessment
    bullets = [
        f"{c.label} (LLR {c.log_likelihood_ratio:+.2f})"
        for c in assessment.contributions
        if c.active
    ]
    if not bullets:
        bullets.append("No high-weight fraud signals triggered; posterior near prior.")

    summary = (
        f"{data.profile_name}: fraud probability {assessment.score:.1%} "
        f"({assessment.confidence.value} confidence)."
    )
    return StructuredExplanation(
        summary=summary,
        bullets=bullets,
        confidence=assessment.confidence,
        source="deterministic",
    )


def _deterministic_team_explanation(data: TeamExplanationInput) -> StructuredExplanation:
    result = data.result
    constraints = data.constraints

    if not result.solved:
        return StructuredExplanation(
            summary="No feasible team within constraints.",
            bullets=[
                f"Budget ${constraints.budget:,.0f} with {constraints.team_size} slots.",
                f"Required skills: {', '.join(constraints.required_skills)}.",
                f"CSP explored {result.stats.nodes_explored} nodes "
                f"({result.stats.forward_prunes} pruned).",
            ],
            confidence=ConfidenceLevel.MEDIUM,
            source="deterministic",
        )

    names = ", ".join(m.name for m in result.team)
    covered: set[str] = set()
    for member in result.team:
        covered.update(member.skills)
    missing = [s for s in constraints.required_skills if s not in covered]

    bullets = [
        f"Members: {names}.",
        f"Total cost ${result.total_cost:,.0f} / ${constraints.budget:,.0f} budget.",
        f"Skills covered: {len(covered & set(constraints.required_skills))}"
        f"/{len(constraints.required_skills)}.",
    ]
    if missing:
        bullets.append(f"Warning: uncovered skills {', '.join(missing)}.")

    return StructuredExplanation(
        summary="Team satisfies CSP constraints via backtracking with forward checking.",
        bullets=bullets[:3],
        confidence=ConfidenceLevel.HIGH,
        source="deterministic",
    )


async def _call_claude(system: str, user: str, max_tokens: int = 1000) -> llm.LLMResult[str] | None:
    try:
        return await llm.complete(system=system, user=user, max_tokens=max_tokens)
    except llm.LLMUnavailable:
        return None


def _parse_claude_to_structured(
    result: llm.LLMResult[str], fallback: StructuredExplanation
) -> StructuredExplanation:
    lines = [ln.strip() for ln in result.value.splitlines() if ln.strip()]
    if not lines:
        return fallback
    summary = lines[0]
    bullets: list[str] = []
    for line in lines[1:]:
        cleaned = line.lstrip("-•* ").strip()
        if cleaned:
            bullets.append(cleaned)
    if not bullets:
        bullets = fallback.bullets
    return StructuredExplanation(
        summary=summary,
        bullets=bullets,
        confidence=fallback.confidence,
        source="claude",
        usage=result.usage.as_metadata(),
    )


async def explain_search(data: SearchExplanationInput) -> StructuredExplanation:
    fallback = _deterministic_search_explanation(data)
    top_lines = [
        f"#{m.rank} {m.candidate.name} score={m.match_score} "
        f"breakdown={m.breakdown.model_dump()}"
        for m in data.top_matches[:5]
    ]
    user = (
        f"Query: {data.query}\n"
        f"Skills: {', '.join(data.required_skills) or 'any'}\n"
        f"Budget: {data.budget} Team: {data.team_size}\n"
        f"Top matches:\n" + "\n".join(top_lines)
    )
    result = await _call_claude(SEARCH_SYSTEM, user)
    if result:
        return _parse_claude_to_structured(result, fallback)
    return fallback


async def explain_fraud(data: FraudExplanationInput) -> StructuredExplanation:
    fallback = _deterministic_fraud_explanation(data)
    a = data.assessment
    user = (
        f"Profile: {data.profile_name}\n"
        f"Score: {a.score} Flagged: {a.is_flagged}\n"
        f"Active signals: {', '.join(a.signals) or 'none'}\n"
        f"Risk factors: {', '.join(a.risk_factors)}"
    )
    result = await _call_claude(FRAUD_SYSTEM, user)
    if result:
        return _parse_claude_to_structured(result, fallback)
    return fallback


async def explain_team(data: TeamExplanationInput) -> StructuredExplanation:
    fallback = _deterministic_team_explanation(data)
    r = data.result
    c = data.constraints
    if r.solved:
        user = (
            f"Team: {', '.join(m.name for m in r.team)}\n"
            f"Cost: {r.total_cost} Budget: {c.budget}\n"
            f"Skills: {', '.join(c.required_skills)}\n"
            f"Stats: backtracks={r.stats.backtracks} nodes={r.stats.nodes_explored}"
        )
    else:
        user = (
            f"No team. Budget: {c.budget} Size: {c.team_size}\n"
            f"Skills: {', '.join(c.required_skills)}"
        )
    result = await _call_claude(TEAM_SYSTEM, user)
    if result:
        return _parse_claude_to_structured(result, fallback)
    return fallback

