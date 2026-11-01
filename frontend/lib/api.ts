import { getSession } from 'next-auth/react'

export interface FreelancerRecord {
  id: number
  name: string
  skills: string[]
  rating: number
  hourly_rate: number
  experience_years: number
  account_age_days: number
  fraud_score: number
  bio?: string
  location?: string
  availability: boolean
  review_count: number
  portfolio_urls: string[]
}

export interface FreelancerListResponse {
  freelancers: FreelancerRecord[]
  total: number
}

export interface FreelancerCreateRequest {
  name: string
  skills?: string[]
  hourly_rate?: number
  experience_years?: number
  rating?: number
  review_count?: number
  account_age_days?: number
  availability?: boolean
  portfolio_urls?: string[]
}

export interface FreelancerCreateResponse {
  freelancer: FreelancerRecord
  message: string
}

export interface FreelancerUpdateRequest {
  name?: string
  skills?: string[]
  hourly_rate?: number
  experience_years?: number
  rating?: number
  review_count?: number
  account_age_days?: number
  availability?: boolean
  portfolio_urls?: string[]
  bio?: string
  location?: string
}

export interface ProjectRecord {
  id: number
  title?: string
  description?: string
  required_skills: string[]
  budget: number
  deadline_days: number
  team_size: number
  status: string
  team_members: number[]
  client?: string
  created?: string
  priority?: string
  nice_to_have_skills?: string[]
  seniority_level?: Seniority
  budget_type?: BudgetType
  domain?: string | null
  compliance?: string[]
  implicit_constraints?: string[]
}

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead'
export type BudgetType = 'fixed' | 'hourly'

export interface ProjectListResponse {
  projects: ProjectRecord[]
  total: number
}

export interface ProjectCreateRequest {
  title: string
  description?: string
  client?: string
  required_skills?: string[]
  nice_to_have_skills?: string[]
  budget: number
  budget_type?: BudgetType
  deadline_days?: number
  team_size?: number
  seniority_level?: Seniority
  domain?: string | null
  compliance?: string[]
  implicit_constraints?: string[]
}

export interface GroundedSkill {
  input: string
  canonical: string | null
  importance: 'must' | 'nice'
  match: 'exact' | 'alias' | 'semantic' | 'none'
  confidence: number
  category: string | null
}

export interface ProjectExtractionResponse {
  title: string
  summary: string
  skills: GroundedSkill[]
  budget: number | null
  budget_type: BudgetType
  deadline_days: number | null
  team_size: number
  seniority_level: Seniority
  domain: string | null
  compliance: string[]
  implicit_constraints: string[]
  ambiguities: string[]
  source: 'claude' | 'deterministic'
}

export interface ProjectCreateResponse {
  project: ProjectRecord
}

export interface ProjectUpdateRequest {
  title?: string
  description?: string
  required_skills?: string[]
  budget?: number
  deadline_days?: number
  team_size?: number
}

export interface ContractRecord {
  id: number
  freelancer_id: number
  project_id: number
  status: string
  created_at?: string
}

export interface ContractListResponse {
  contracts: ContractRecord[]
  total: number
}

export interface ContractCreateRequest {
  freelancer_id: number
  project_id: number
  status?: string
}

export interface ContractBatchRequest {
  project_id: number
  freelancer_ids: number[]
  status?: string
}

export type ContractStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export interface SearchRequest {
  query: string
  skills: string[]
  minRate?: number
  maxRate?: number
  minRating?: number
  availableOnly: boolean
  maxFraud: number
  budget?: number
  team_size?: number
  niceToHaveSkills?: string[]
  seniorityLevel?: Seniority
  budgetType?: BudgetType
  rerank?: boolean
}

/** A claim about a candidate; evidence refs look like "f12.skills" or "f12.project:7". */
export interface ReasoningClaim {
  text: string
  evidence: string[]
}

export interface CandidateReasoning {
  /** LLM fit 0-100; null when the deterministic path produced the reasoning. */
  fit_score: number | null
  strengths: ReasoningClaim[]
  risks: ReasoningClaim[]
  biggest_gap: string | null
}

export interface RankedMatch extends FreelancerRecord {
  /** Final score shown to users (blended with the LLM fit when it ran). */
  match_score: number
  deterministic_match_score?: number
  rank_score: number
  rank?: number
  reasoning?: CandidateReasoning
  /** Present for the reranked head when a graph backend was available. */
  graph?: CandidateGraphFacts
}

export interface MatchComparison {
  preferred_id: number
  other_id: number
  reason: string
  evidence: string[]
}

export interface RerankingInfo {
  path: 'llm' | 'deterministic'
  alpha: number
  top_n: number
  stripped_claims: number
  cached: boolean
  comparisons: MatchComparison[]
  error: string | null
}

export interface SearchResponse {
  freelancers: RankedMatch[]
  explanation: string
  total_candidates: number
  retrieval?: { mode: string; skill_filter: 'strict' | 'expanded' | 'relaxed' | 'none' }
  reranking?: RerankingInfo
  graph?: SearchGraphInfo
}

export interface PrecomputedResult {
  precomputed: boolean
  project_id: number
  computed_at?: string
  ranked_freelancers: RankedMatch[]
  reranking?: RerankingInfo
  graph?: SearchGraphInfo | null
  total_candidates?: number
  message?: string
}

export interface FraudRequest {
  freelancer_id?: number
  name?: string
  account_age_days?: number
  rating?: number
  hourly_rate?: number
  experience_years?: number
  review_count?: number
  portfolio_urls?: string[]
  skills?: string[]
}

export interface FraudResponse {
  score: number
  confidence: 'low' | 'medium' | 'high'
  signals: string[]
  risk_factors: string[]
  is_flagged: boolean
  explanation: string
  freelancer?: FreelancerRecord
  source?: string
  ran_at?: string
}

export interface TeamBuilderRequest {
  budget: number
  required_skills: string[]
  team_size: number
  hours_per_member?: number
  max_fraud_score?: number
  project_id?: number
  deadline_days?: number
}

export interface TeamBuilderResponse {
  success: boolean
  team: FreelancerRecord[]
  total_cost: number
  explanation: string
  message?: string
  backtracks: number
  nodes_explored: number
  /** Chosen members who completed projects together (from the graph). */
  collaborations?: TeamCollaboration[]
  graph_source?: GraphSource
}

export interface TeamCollaboration {
  a_id: number
  a_name: string
  b_id: number
  b_name: string
  project_ids: number[]
  project_titles: string[]
  count: number
  avg_rating: number | null
}

export interface TeamBuildStatus {
  status: string
}

/** "off": no graph context; "error": the graph failed and search ran without it. */
export type GraphSource = 'neo4j' | 'postgres' | 'off' | 'error'

export interface GraphNode {
  /** f-<id> freelancer, s-<skill>, p-<id> project, c-<id> client */
  id: string
  name: string
  type: 'freelancer' | 'skill' | 'project' | 'client'
  fraud_score?: number | null
}

export type GraphLinkType =
  | 'HAS_SKILL' | 'RELATED_TO' | 'REQUIRES' | 'WORKED_ON' | 'POSTED' | 'COLLABORATED_WITH'

export interface GraphLink {
  source: string
  target: string
  type: GraphLinkType | string
  /** RELATED_TO weight */
  weight?: number | null
  /** e.g. WORKED_ON {status, rating}, COLLABORATED_WITH {count, avg_rating, project_ids} */
  properties?: Record<string, unknown>
}

export interface GraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
  source: 'neo4j' | 'postgres'
  /** Node id the subgraph is centred on; null for the overview. */
  focus?: string | null
}

export interface GraphQuery {
  freelancerId?: number
  projectId?: number
  limit?: number
}

/** Graph facts shown to the reasoner for one candidate (subgraph_to_prompt). */
export interface CandidateGraphFacts {
  skill_paths: { required: string; via: string; hops: number; weight: number; path: string[] }[]
  past_projects: { id: number; title: string; shared_skills: string[] }[]
  collaborations: {
    other_id: number
    other_name: string
    project_ids: number[]
    count: number
    avg_rating: number | null
  }[]
}

export interface SearchGraphInfo {
  source: GraphSource
  /** {required skill: {related skill: weight}}, multi-hop, lower-cased */
  expanded_skills: Record<string, Record<string, number>>
  error?: string | null
}

export interface PlatformStatsResponse {
  freelancers_total: number
  open_projects: number
  fraud_flagged: number
  teams_built: number
  projects_total?: number
}

export interface DayMetrics {
  label: string
  searches: number
  teams: number
  fraud: number
}

export interface TimeSeriesResponse {
  data: DayMetrics[]
  total_searches: number
  total_teams: number
  total_fraud: number
}

export interface HealthResponse {
  status: string
  postgres: string
  mongodb: string
  neo4j: string
  anthropic_configured: boolean
}

export interface SeedRequest {
  freelancer_count: number
  reset: boolean
}

export interface SeedResponse {
  success: boolean
  message: string
  freelancers_created: number
  projects_created: number
  contracts_created: number
  neo4j_synced: boolean
}

export interface ActivityFeedItem {
  id: string
  type: string
  text: string
  time: string
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[]
}

export interface RecentSearchItem {
  query: string
  results: number
  time: string
}

export interface RecentSearchResponse {
  searches: RecentSearchItem[]
}

export interface SkillListResponse {
  skills: string[]
}

export interface UserPreferences {
  notifications_enabled: boolean
  email_alerts: boolean
  fraud_sensitivity: number
  preferred_skills: string[]
  theme: string
}

export interface UserSettingsResponse {
  user_id: number
  preferences: UserPreferences
}

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Backend JWT from the NextAuth session. <ApiTokenSync> keeps it current; until it
// has run (child effects fire before parent ones) we fall back to getSession().
let apiToken: string | undefined

export function setApiToken(token: string | undefined) {
  apiToken = token
}

async function currentToken(): Promise<string | undefined> {
  if (apiToken || typeof window === 'undefined') return apiToken
  const session = await getSession()
  apiToken = session?.accessToken
  return apiToken
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await currentToken()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

// ── FREELANCERS ──────────────────────────────────────────────
export const api = {
  freelancers: {
    list:   (q?: string, flaggedOnly?: boolean) =>
      req<FreelancerListResponse>(`/freelancers?${new URLSearchParams({
        ...(q ? {q} : {}),
        ...(flaggedOnly ? {flagged_only:'true'} : {}),
      })}`),
    get:    (id: number) => req<FreelancerRecord>(`/freelancers/${id}`),
    create: (body: FreelancerCreateRequest) =>
      req<FreelancerCreateResponse>('/freelancers', { method:'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<FreelancerUpdateRequest>) =>
      req<FreelancerRecord>(`/freelancers/${id}`, { method:'PATCH', body: JSON.stringify(body) }),
    flag:   (id: number, isFlagged: boolean) =>
      req<FreelancerRecord>(`/freelancers/${id}/flag`, { method:'PATCH', body: JSON.stringify({is_flagged: isFlagged}) }),
    skills: () => req<SkillListResponse>('/freelancers/skills/list'),
  },

  // ── PROJECTS ─────────────────────────────────────────────
  projects: {
    list:   () => req<ProjectListResponse>('/projects'),
    get:    (id: number) => req<ProjectRecord>(`/projects/${id}`),
    create: (body: ProjectCreateRequest) =>
      req<ProjectCreateResponse>('/projects', { method:'POST', body: JSON.stringify(body) }),
    extract: (text: string) =>
      req<ProjectExtractionResponse>('/projects/extract', { method:'POST', body: JSON.stringify({ text }) }),
    update: (id: number, body: Partial<ProjectUpdateRequest>) =>
      req<ProjectRecord>(`/projects/${id}`, { method:'PATCH', body: JSON.stringify(body) }),
  },

  // ── CONTRACTS ────────────────────────────────────────────
  contracts: {
    all:           () => req<ContractListResponse>('/contracts'),
    byFreelancer:  (id: number) => req<ContractListResponse>(`/contracts/freelancer/${id}`),
    byProject:     (id: number) => req<ContractListResponse>(`/contracts/project/${id}`),
    create:        (body: ContractCreateRequest) =>
      req<ContractRecord>('/contracts', { method:'POST', body: JSON.stringify(body) }),
    batch:         (body: ContractBatchRequest) =>
      req<ContractListResponse>('/contracts/batch', { method:'POST', body: JSON.stringify(body) }),
    updateStatus:  (id: number, status: ContractStatus) =>
      req<ContractRecord>(`/contracts/${id}`, { method:'PATCH', body: JSON.stringify({status}) }),
  },

  // ── SEARCH ───────────────────────────────────────────────
  search: {
    run:          (body: SearchRequest) =>
      req<SearchResponse>('/search', { method:'POST', body: JSON.stringify(body) }),
    precomputed:  (projectId: number) =>
      req<PrecomputedResult>(`/search/precomputed/${projectId}`),
  },

  // ── FRAUD ────────────────────────────────────────────────
  fraud: {
    get:     (freelancerId: number) => req<FraudResponse>(`/fraud/${freelancerId}`),
    analyze: (body: FraudRequest) =>
      req<FraudResponse>('/fraud', { method:'POST', body: JSON.stringify(body) }),
  },

  // ── TEAM BUILDER ─────────────────────────────────────────
  teamBuilder: {
    build:  (body: TeamBuilderRequest) =>
      req<TeamBuilderResponse>('/team-builder', { method:'POST', body: JSON.stringify(body) }),
    status: (projectId: number) =>
      req<TeamBuildStatus>(`/team-builder/status/${projectId}`),
  },

  // ── REST ─────────────────────────────────────────────────
  graph: (q: GraphQuery = {}) => {
    const params = new URLSearchParams()
    if (q.freelancerId) params.set('freelancer_id', String(q.freelancerId))
    if (q.projectId) params.set('project_id', String(q.projectId))
    if (q.limit) params.set('limit', String(q.limit))
    const qs = params.toString()
    return req<GraphResponse>(`/graph${qs ? `?${qs}` : ''}`)
  },
  stats:     () => req<PlatformStatsResponse>('/stats'),
  analytics: (days?: number) => req<TimeSeriesResponse>(`/analytics${days ? `?days=${days}` : ''}`),
  health:    () => req<HealthResponse>('/health'),
  seed:      (body: SeedRequest) =>
    req<SeedResponse>('/seed', { method:'POST', body: JSON.stringify(body) }),
  activity: {
    feed:    () => req<ActivityFeedResponse>('/activity/feed'),
    recent:  () => req<RecentSearchResponse>('/activity/searches/recent'),
  },
  settings: {
    get:  (userId: number) => req<UserSettingsResponse>(`/settings/${userId}`),
    save: (userId: number, body: UserPreferences) =>
      req<UserSettingsResponse>(`/settings/${userId}`, { method:'POST', body: JSON.stringify(body) }),
  },
}
