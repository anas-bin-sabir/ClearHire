'use client'

import { CheckCircle2, AlertTriangle, Target, Share2 } from 'lucide-react'
import type { CandidateGraphFacts, CandidateReasoning, ReasoningClaim } from '@/lib/api'

const PATH_PREFIX = 'graph:path:'
const COLLAB_PREFIX = 'graph:collab:'

function projectTitle(graph: CandidateGraphFacts | undefined, id: number): string | undefined {
  return graph?.past_projects.find(p => p.id === id)?.title
}

export function isGraphRef(ref: string): boolean {
  return /^f\d+\.graph:/.test(ref)
}

/**
 * Human label for an evidence ref.
 * "f12.skills" -> "skills", "f12.project:7" -> "project #7" (or its title),
 * "f12.graph:path:Kubernetes" -> "Docker → Kubernetes",
 * "f12.graph:collab:31" -> "worked with #31 on Project X".
 * ``graph`` is the candidate's graph facts; without it graph refs get a generic label.
 */
export function evidenceLabel(ref: string, graph?: CandidateGraphFacts): string {
  const field = ref.replace(/^f\d+\./, '')
  if (field.startsWith('project:')) {
    const id = Number(field.slice('project:'.length))
    const title = projectTitle(graph, id)
    return title ? `project: ${title}` : `project #${id}`
  }
  if (field.startsWith(PATH_PREFIX)) {
    const required = field.slice(PATH_PREFIX.length)
    const path = graph?.skill_paths.find(p => p.required.toLowerCase() === required.toLowerCase())
    return path ? path.path.join(' → ') : `path to ${required}`
  }
  if (field.startsWith(COLLAB_PREFIX)) {
    const otherId = Number(field.slice(COLLAB_PREFIX.length))
    const collab = graph?.collaborations.find(c => c.other_id === otherId)
    if (!collab) return `worked with #${otherId}`
    const title = collab.project_ids.map(id => projectTitle(graph, id)).find(Boolean)
    const where = title ? ` on ${title}` : ` on ${collab.count} project${collab.count === 1 ? '' : 's'}`
    return `worked with #${otherId} ${collab.other_name}${where}`
  }
  return field.replace(/_/g, ' ')
}

function ClaimList({
  claims, tone, graph, heading,
}: { claims: ReasoningClaim[]; tone: 'good' | 'risk'; graph?: CandidateGraphFacts; heading: string }) {
  const Icon = tone === 'good' ? CheckCircle2 : AlertTriangle
  const color = tone === 'good' ? 'text-ok' : 'text-warn'
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-fg-2">{heading}</p>
      <ul className="space-y-2">
        {claims.map((claim, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden />
            <span>
              {claim.text}
              {claim.evidence.length > 0 && (
                <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                  {claim.evidence.map(ref => {
                    const fromGraph = isGraphRef(ref)
                    return (
                      <span
                        key={ref}
                        title={fromGraph ? `Graph fact: ${ref}` : `Profile field: ${ref}`}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-px font-mono text-[11px] ${
                          fromGraph ? 'bg-teal-tint text-teal-ink' : 'bg-sunken text-fg-2'
                        }`}
                      >
                        {fromGraph && <Share2 className="h-3 w-3" aria-label="from the knowledge graph" />}
                        {evidenceLabel(ref, graph)}
                      </span>
                    )
                  })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Props {
  reasoning: CandidateReasoning
  /** Deterministic score before blending, shown next to the LLM fit. */
  deterministicScore?: number
  /** The candidate's graph facts, used to label graph evidence refs. */
  graph?: CandidateGraphFacts
}

/** Evidence-backed strengths, risks and the biggest gap for one candidate. AI output: teal rule. */
export function MatchReasoning({ reasoning, deterministicScore, graph }: Props) {
  const { strengths, risks, biggest_gap, fit_score } = reasoning
  if (!strengths.length && !risks.length && !biggest_gap) return null

  return (
    <div className="ai-rule space-y-4">
      {fit_score !== null && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <div className="flex gap-1.5">
            <dt className="text-fg-2">AI fit</dt>
            <dd className="font-semibold tabular-nums text-teal-ink">{Math.round(fit_score)}</dd>
          </div>
          {deterministicScore !== undefined && (
            <div className="flex gap-1.5">
              <dt className="text-fg-2">Ranker score</dt>
              <dd className="font-semibold tabular-nums text-fg">{Math.round(deterministicScore)}</dd>
            </div>
          )}
        </dl>
      )}
      {strengths.length > 0 && <ClaimList claims={strengths} tone="good" graph={graph} heading="Strengths" />}
      {risks.length > 0 && <ClaimList claims={risks} tone="risk" graph={graph} heading="Risks" />}
      {biggest_gap && (
        <p className="flex gap-2 text-[13px] text-fg">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <span><span className="font-semibold">Biggest gap:</span> {biggest_gap}</span>
        </p>
      )}
    </div>
  )
}
