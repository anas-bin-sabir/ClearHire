'use client'

import { CheckCircle2, AlertTriangle, Target } from 'lucide-react'
import type { CandidateReasoning, ReasoningClaim } from '@/lib/api'

/** "f12.skills" -> "skills", "f12.project:7" -> "project #7" */
export function evidenceLabel(ref: string): string {
  const field = ref.replace(/^f\d+\./, '')
  return field.startsWith('project:') ? `project #${field.slice('project:'.length)}` : field.replace(/_/g, ' ')
}

function ClaimList({ claims, tone }: { claims: ReasoningClaim[]; tone: 'good' | 'risk' }) {
  const Icon = tone === 'good' ? CheckCircle2 : AlertTriangle
  const color = tone === 'good' ? 'text-emerald-400' : 'text-amber-400'
  return (
    <ul className="space-y-1.5">
      {claims.map((claim, i) => (
        <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
          <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
          <span>
            {claim.text}
            {claim.evidence.length > 0 && (
              <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                {claim.evidence.map(ref => (
                  <span
                    key={ref}
                    title={ref}
                    className="px-1.5 py-px rounded bg-white/5 border border-white/5 text-[10px] font-mono text-slate-400"
                  >
                    {evidenceLabel(ref)}
                  </span>
                ))}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  reasoning: CandidateReasoning
  /** Deterministic score before blending, shown next to the LLM fit. */
  deterministicScore?: number
}

export function MatchReasoning({ reasoning, deterministicScore }: Props) {
  const { strengths, risks, biggest_gap, fit_score } = reasoning
  if (!strengths.length && !risks.length && !biggest_gap) return null

  return (
    <div className="mt-3 rounded-xl border border-indigo-500/10 bg-indigo-500/3 p-4 space-y-3">
      {fit_score !== null && (
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span>AI fit <span className="text-white font-semibold">{Math.round(fit_score)}</span></span>
          {deterministicScore !== undefined && (
            <span>ranker <span className="text-white font-semibold">{Math.round(deterministicScore)}</span></span>
          )}
        </div>
      )}
      {strengths.length > 0 && <ClaimList claims={strengths} tone="good" />}
      {risks.length > 0 && <ClaimList claims={risks} tone="risk" />}
      {biggest_gap && (
        <p className="flex gap-2 text-xs text-slate-400">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-400" />
          <span>Biggest gap: <span className="text-slate-200">{biggest_gap}</span></span>
        </p>
      )}
    </div>
  )
}
