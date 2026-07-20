from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.ai import llm
from app.ai.project_parser import (
    build_extraction_response,
    extract_deterministic,
    extract_with_llm,
)
from app.core.dependencies import (
    get_ai_explanation_repo,
    get_contract_repo,
    get_project_repo,
    get_skill_taxonomy_repo,
    owns_project,
    require_client,
)
from app.core.rate_limit import enforce_public_rate_limit, enforce_user_action_rate_limit
from app.core.search_pipeline import precompute_project_matches
from app.db.repositories.postgres import (
    AIExplanationRepository,
    ContractRepository,
    ProjectRepository,
    SkillRepository,
)
from app.db.utils.serializers import project_to_dict
from app.models.orm import ContractStatus, User
from app.models.schemas import (
    ProjectExtractionRequest,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectExtractionResponse,
    ProjectListResponse,
    ProjectRecord,
    ProjectUpdateRequest,
)

router = APIRouter()


@router.post(
    "/extract",
    response_model=ProjectExtractionResponse,
    dependencies=[Depends(enforce_user_action_rate_limit)],
)
async def extract_requirements(
    body: ProjectExtractionRequest,
    user: User = Depends(require_client),
    skill_repo: SkillRepository = Depends(get_skill_taxonomy_repo),
    ai_explanation_repo: AIExplanationRepository = Depends(get_ai_explanation_repo),
) -> ProjectExtractionResponse:
    """Parse a raw brief; the client reviews and edits this before creating a project."""
    usage: dict | None = None
    fallback_reason: str | None = None
    try:
        result = await extract_with_llm(body.text)
        parsed, source = result.value, "claude"
        usage = result.usage.as_metadata()
    except llm.LLMUnavailable as exc:
        parsed, source = extract_deterministic(body.text), "deterministic"
        fallback_reason = str(exc)

    grounded = await skill_repo.ground([(s.name, s.importance) for s in parsed.skills])
    response = build_extraction_response(parsed, grounded, source)

    await ai_explanation_repo.insert(
        endpoint="/projects/extract",
        explanation=response.summary,
        model=(usage or {}).get("model", "deterministic"),
        system_prompt="project_extraction",
        user_prompt=body.text[:2000],
        entity_id=user.id,
        entity_type="user",
        pipeline="project_extraction",
        metadata={
            "source": source,
            "usage": usage,
            "fallback_reason": fallback_reason,
            "skills": [s.canonical or s.input for s in response.skills],
            "ambiguities": len(response.ambiguities),
        },
    )
    return response


def resolve_project_status(contracts: list) -> str:
    if not contracts:
        return "open"
    statuses = {c.status for c in contracts}
    if ContractStatus.ACTIVE.value in statuses:
        return "in_progress"
    if statuses == {ContractStatus.COMPLETED.value}:
        return "completed"
    if ContractStatus.PENDING.value in statuses:
        return "open"
    return "open"


def _build_description(body: ProjectCreateRequest) -> str | None:
    desc = (body.description or "").strip()
    if body.client:
        prefix = f"Client: {body.client.strip()}"
        return f"{prefix}\n\n{desc}" if desc else prefix
    return desc or None


def _extract_client(description: str | None) -> str | None:
    if not description:
        return None
    first = description.split("\n", 1)[0].strip()
    if first.lower().startswith("client:"):
        return first.split(":", 1)[1].strip() or None
    return None


def _record_from_project(project, contracts: list) -> ProjectRecord:
    base = project_to_dict(project)
    team_members = [c.freelancer_id for c in contracts]
    return ProjectRecord(
        id=base["id"],
        title=base.get("title") or "Untitled",
        description=base.get("description") or "",
        required_skills=base.get("required_skills") or [],
        budget=base.get("budget") or 0,
        deadline_days=base.get("deadline_days") or 30,
        team_size=base.get("team_size") or 1,
        status=resolve_project_status(contracts),
        team_members=team_members,
        client=_extract_client(base.get("description")),
        created=base.get("created_at"),
        nice_to_have_skills=base.get("nice_to_have_skills") or [],
        seniority_level=base.get("seniority_level") or "mid",
        budget_type=base.get("budget_type") or "fixed",
        domain=base.get("domain"),
        compliance=base.get("compliance") or [],
        implicit_constraints=base.get("implicit_constraints") or [],
    )


@router.get(
    "",
    response_model=ProjectListResponse,
    dependencies=[Depends(enforce_public_rate_limit)],
)
async def list_projects(
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectListResponse:
    projects = await project_repo.list_all(limit=100)
    project_ids = [p.id for p in projects]
    contracts_by_project = await contract_repo.list_by_project_ids(project_ids)

    records: list[ProjectRecord] = []
    for project in projects:
        contracts = contracts_by_project.get(project.id, [])
        records.append(_record_from_project(project, contracts))

    return ProjectListResponse(projects=records, total=len(records))


@router.post(
    "",
    response_model=ProjectCreateResponse,
    status_code=201,
    dependencies=[Depends(enforce_user_action_rate_limit)],
)
async def create_project(
    body: ProjectCreateRequest,
    background_tasks: BackgroundTasks,
    project_repo: ProjectRepository = Depends(get_project_repo),
    user: User = Depends(require_client),
) -> ProjectCreateResponse:
    project = await project_repo.create(
        client_id=user.id,
        title=body.title.strip(),
        description=_build_description(body),
        required_skills=body.required_skills,
        budget=body.budget,
        deadline_days=body.deadline_days,
        team_size=body.team_size,
        seniority_level=body.seniority_level,
        implicit_constraints=body.implicit_constraints,
        nice_to_have_skills=body.nice_to_have_skills,
        budget_type=body.budget_type,
        domain=body.domain,
        compliance=body.compliance,
    )
    record = _record_from_project(project, [])
    # Runs after the response (and after the request session commits the project).
    background_tasks.add_task(precompute_project_matches, project.id)
    return ProjectCreateResponse(project=record)


@router.get(
    "/{project_id}",
    response_model=ProjectRecord,
    dependencies=[Depends(enforce_public_rate_limit)],
)
async def get_project(
    project_id: int,
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
) -> ProjectRecord:
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    contracts = await contract_repo.list_by_project(project_id)
    return _record_from_project(project, contracts)


@router.patch(
    "/{project_id}",
    response_model=ProjectRecord,
    dependencies=[Depends(enforce_user_action_rate_limit)],
)
async def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    project_repo: ProjectRepository = Depends(get_project_repo),
    contract_repo: ContractRepository = Depends(get_contract_repo),
    user: User = Depends(require_client),
) -> ProjectRecord:
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not owns_project(user, project):
        raise HTTPException(status_code=403, detail="Not your project")
    updated = await project_repo.update(project_id, body.model_dump(exclude_none=True))
    contracts = await contract_repo.list_by_project(project_id)
    return _record_from_project(updated, contracts)
