const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `Request failed (${response.status})`;
    throw new ApiError(detail, response.status, data);
  }

  return data as T;
}

// --- Types ---

export interface FreelancerRecord {
  id: number;
  name: string;
  skills: string[];
  rating?: number;
  hourly_rate?: number;
  experience_years?: number;
  account_age_days?: number;
  fraud_score?: number;
  bio?: string | null;
  location?: string | null;
  availability?: boolean;
  review_count?: number;
  portfolio_urls?: string[];
  match_score?: number;
  rank_score?: number;
  fScore?: number;
  rank?: number;
  avatar?: string;
  reviews?: Array<{ author: string; text: string; rating: number }>;
  [key: string]: unknown;
}

export interface SearchRequest {
  query?: string;
  skills?: string[];
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  availableOnly?: boolean;
  maxFraud?: number;
  budget?: number;
  team_size?: number;
}

export interface SearchResponse {
  freelancers: FreelancerRecord[];
  explanation: string;
  total_candidates: number;
}

export interface FraudRequest {
  freelancer_id?: number;
  name?: string;
  account_age_days?: number;
  rating?: number;
  hourly_rate?: number;
  experience_years?: number;
  review_count?: number;
  portfolio_urls?: string[];
  skills?: string[];
}

export interface FraudResponse {
  score: number;
  confidence: string;
  signals: string[];
  risk_factors: string[];
  is_flagged: boolean;
  freelancer?: FreelancerRecord | null;
  explanation: string;
  source?: string;
  ran_at?: string;
  note?: string;
}

export interface TeamBuilderRequest {
  budget: number;
  required_skills: string[];
  team_size: number;
  hours_per_member?: number;
  max_fraud_score?: number;
  project_id?: number;
  deadline_days?: number;
}

export interface TeamBuilderResponse {
  success: boolean;
  team: FreelancerRecord[];
  total_cost: number;
  explanation: string;
  message?: string | null;
  backtracks?: number;
  nodes_explored?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: "freelancer" | "skill" | "project";
  fraud_score?: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  source: string;
}

export interface SeedResponse {
  success: boolean;
  message: string;
  freelancers_created: number;
  projects_created: number;
  contracts_created?: number;
  neo4j_synced?: boolean;
}

export interface PlatformStats {
  freelancers_total: number;
  open_projects: number;
  fraud_flagged: number;
  teams_built: number;
  projects_total: number;
}

export interface HealthStatus {
  status: string;
  postgres: string;
  mongodb: string;
  neo4j: string;
  anthropic_configured: boolean;
}

export interface ProjectRecord {
  id: number;
  title: string;
  description?: string;
  required_skills: string[];
  budget: number;
  deadline_days: number;
  team_size: number;
  status: string;
  team_members: number[];
  client?: string;
  created?: string;
  priority?: string;
}

export interface DayMetrics {
  label: string;
  searches: number;
  teams: number;
  fraud: number;
}

export interface TimeSeriesResponse {
  data: DayMetrics[];
  total_searches: number;
  total_teams: number;
  total_fraud: number;
  period: string;
}

export interface UserPreferences {
  notifications_enabled: boolean;
  email_alerts: boolean;
  fraud_sensitivity: number;
  preferred_skills: string[];
  theme: string;
}

export interface UserSettingsResponse {
  user_id: number;
  preferences: UserPreferences;
}

export interface ProjectCreateRequest {
  title: string;
  description?: string;
  client?: string;
  required_skills: string[];
  budget: number;
  deadline_days: number;
  team_size: number;
}

export interface ProjectCreateResponse {
  project: ProjectRecord;
}

export interface ContractRecord {
  id: number;
  freelancer_id: number;
  project_id: number;
  status: string;
  created_at?: string;
}

export interface ContractBatchRequest {
  project_id: number;
  freelancer_ids: number[];
  status?: string;
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  text: string;
  time: string;
}

export interface RecentSearchItem {
  query: string;
  results: number;
  time: string;
}

// --- API functions ---

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/health", { method: "GET" });
}

export function getPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/stats", { method: "GET" });
}

export function listFreelancers(params?: {
  q?: string;
  limit?: number;
  flaggedOnly?: boolean;
}): Promise<{ freelancers: FreelancerRecord[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.flaggedOnly) search.set("flagged_only", "true");
  const qs = search.toString();
  return request(`/freelancers${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export function getFreelancer(id: number): Promise<FreelancerRecord> {
  return request<FreelancerRecord>(`/freelancers/${id}`, { method: "GET" });
}

export function listProjects(): Promise<{
  projects: ProjectRecord[];
  total: number;
}> {
  return request("/projects", { method: "GET" });
}

export function createProject(
  body: ProjectCreateRequest,
): Promise<ProjectCreateResponse> {
  return request<ProjectCreateResponse>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listContractsByProject(
  projectId: number,
): Promise<{ contracts: ContractRecord[]; total: number }> {
  return request(`/contracts/project/${projectId}`, { method: "GET" });
}

export function listContractsByFreelancer(
  freelancerId: number,
): Promise<{ contracts: ContractRecord[]; total: number }> {
  return request(`/contracts/freelancer/${freelancerId}`, { method: "GET" });
}

export function createContract(body: {
  freelancer_id: number;
  project_id: number;
  status?: string;
}): Promise<ContractRecord> {
  return request<ContractRecord>("/contracts", {
    method: "POST",
    body: JSON.stringify({
      freelancer_id: body.freelancer_id,
      project_id: body.project_id,
      status: body.status ?? "active",
    }),
  });
}

export function assignTeamToProject(
  projectId: number,
  freelancerIds: number[],
  status = "active",
): Promise<{ contracts: ContractRecord[]; total: number }> {
  return request("/contracts/batch", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      freelancer_ids: freelancerIds,
      status,
    }),
  });
}

export function getActivityFeed(
  limit = 20,
): Promise<{ items: ActivityFeedItem[] }> {
  return request(`/activity/feed?limit=${limit}`, { method: "GET" });
}

export function getRecentSearches(
  limit = 5,
): Promise<{ searches: RecentSearchItem[] }> {
  return request(`/activity/searches/recent?limit=${limit}`, {
    method: "GET",
  });
}

export function listSkillNames(): Promise<{ skills: string[] }> {
  return request("/freelancers/skills/list", { method: "GET" });
}

export function searchFreelancers(
  body: SearchRequest,
): Promise<SearchResponse> {
  return request<SearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify({
      query: body.query ?? "",
      skills: body.skills ?? [],
      minRate: body.minRate,
      maxRate: body.maxRate,
      minRating: body.minRating,
      availableOnly: body.availableOnly ?? false,
      maxFraud: body.maxFraud ?? 1,
      budget: body.budget ?? 10000,
      team_size: body.team_size ?? 1,
    }),
  });
}

export function getFraudScore(body: FraudRequest): Promise<FraudResponse> {
  if (body.freelancer_id != null && body.name == null) {
    return request<FraudResponse>(`/fraud/${body.freelancer_id}`, { method: "GET" });
  }
  return request<FraudResponse>("/fraud", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPrecomputedSearch(projectId: number): Promise<{
  precomputed: boolean;
  ranked_freelancers?: FreelancerRecord[];
  ran_at?: string;
  total_candidates?: number;
}> {
  return request(`/search/precomputed/${projectId}`, { method: "GET" });
}

export function getTeamBuildStatus(projectId: number): Promise<{
  status: "pending" | "complete";
  ran_at?: string;
  [key: string]: unknown;
}> {
  return request(`/team-builder/status/${projectId}`, { method: "GET" });
}

export function buildTeam(
  body: TeamBuilderRequest,
): Promise<TeamBuilderResponse> {
  return request<TeamBuilderResponse>("/team-builder", {
    method: "POST",
    body: JSON.stringify({
      budget: body.budget,
      required_skills: body.required_skills,
      team_size: body.team_size,
      hours_per_member: body.hours_per_member ?? 40,
      max_fraud_score: body.max_fraud_score ?? 0.6,
      project_id: body.project_id,
      deadline_days: body.deadline_days ?? 30,
    }),
  });
}

export function getGraph(): Promise<GraphResponse> {
  return request<GraphResponse>("/graph", { method: "GET" });
}

export function seedDatabase(
  freelancerCount = 50,
  reset = false,
): Promise<SeedResponse> {
  return request<SeedResponse>("/seed", {
    method: "POST",
    body: JSON.stringify({ freelancer_count: freelancerCount, reset }),
  });
}

export function getAnalyticsTimeseries(
  days: number = 7,
): Promise<TimeSeriesResponse> {
  return request<TimeSeriesResponse>(`/analytics?days=${days}`, {
    method: "GET",
  });
}

export function getUserSettings(userId: number): Promise<UserSettingsResponse> {
  return request<UserSettingsResponse>(`/settings/${userId}`, {
    method: "GET",
  });
}

export function updateUserSettings(
  userId: number,
  preferences: UserPreferences,
): Promise<UserSettingsResponse> {
  return request<UserSettingsResponse>(`/settings/${userId}`, {
    method: "POST",
    body: JSON.stringify(preferences),
  });
}

/** Enrich API freelancer rows with UI fields used by cards */
export function enrichFreelancer(row: FreelancerRecord): FreelancerRecord {
  const name = row.name || `Freelancer ${row.id}`;
  const avatar =
    row.avatar ||
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  return {
    ...row,
    avatar,
    match_score: row.match_score ?? Math.round((row.rank_score ?? 0.5) * 100),
    reviews: row.reviews ?? [],
  };
}

export function mapGraphForUi(resp: GraphResponse) {
  const nodes = (resp.nodes || []).map((n) => ({
    id: n.id,
    label: n.name,
    type: n.type,
    fraud: n.fraud_score ?? (n.type === "freelancer" ? 0.05 : 0),
    x: 0,
    y: 0,
  }));
  const edges = (resp.links || []).map((l) => ({
    source: l.source,
    target: l.target,
    type: l.type,
  }));
  return { nodes, edges, source: resp.source };
}
