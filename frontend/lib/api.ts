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
  retrieval?: { mode: string; skill_filter: 'strict' | 'relaxed' | 'none' }
  reranking?: RerankingInfo
}

export interface PrecomputedResult {
  precomputed: boolean
  project_id: number
  computed_at?: string
  ranked_freelancers: RankedMatch[]
  reranking?: RerankingInfo
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
}

export interface TeamBuildStatus {
  status: string
}

export interface GraphNode {
  id: string
  name: string
  type: 'freelancer' | 'skill' | 'project'
  fraud_score?: number
}

export interface GraphLink {
  source: string
  target: string
  type: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
  source: string
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
  graph:     () => req<GraphResponse>('/graph'),
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
