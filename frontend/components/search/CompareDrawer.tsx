'use client'

import type { MatchComparison, RankedMatch, RerankingInfo } from '@/lib/api'
import { Dialog } from '@/components/ui/Dialog'
import { Avatar } from '@/components/ui/Avatar'
import { MatchReasoning, evidenceLabel } from './MatchReasoning'

interface Props {
  open: boolean
  onClose: () => void
  matches: RankedMatch[]
  reranking?: RerankingInfo
}

function comparisonFor(comparisons: MatchComparison[], a: number, b: number) {
  return comparisons.find(
    c => (c.preferred_id === a && c.other_id === b) || (c.preferred_id === b && c.other_id === a),
  )
}

/** Side-by-side view of the top two matches with the "why #1 over #2" reasoning. */
export function CompareDrawer({ open, onClose, matches, reranking }: Props) {
  const [first, second] = matches
  if (!first || !second) return null
  const comparison = comparisonFor(reranking?.comparisons ?? [], first.id, second.id)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      size="lg"
      title={`${first.name} vs ${second.name}`}
      description={
        reranking?.path === 'llm'
          ? `AI rerank of the top ${reranking.top_n}, blending ${Math.round(reranking.alpha * 100)}% ranker score with ${Math.round((1 - reranking.alpha) * 100)}% AI fit${reranking.cached ? ' (cached result)' : ''}.`
          : 'Deterministic ranking. The AI rerank didn’t run for this search.'
      }
    >
      <div className="space-y-6">
        {comparison && (
          <section className="ai-rule">
            <h3 className="text-sm font-semibold text-fg">Why the higher-ranked candidate wins</h3>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-fg">{comparison.reason}</p>
            {comparison.evidence.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Evidence">
                {comparison.evidence.map(ref => {
                  const owner = ref.match(/^f(\d+)/)?.[1] === String(first.id) ? first : second
                  return (
                    <li key={ref} title={ref} className="rounded-md bg-sunken px-1.5 py-px font-mono text-[11px] text-fg-2">
                      {owner.name}: {evidenceLabel(ref, owner.graph)}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-line">
          {[first, second].map((m, i) => (
            <section key={m.id} className={`space-y-4 ${i === 1 ? 'border-t border-line pt-6 md:border-t-0 md:pl-6 md:pt-0' : ''}`}>
              <div className="flex items-center gap-3">
                <Avatar name={m.name} tone="color" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-fg-2">Rank {i + 1}</p>
                  <h3 className="truncate text-[15px] font-semibold text-fg">{m.name}</h3>
                </div>
                <p className="text-right">
                  <span className="block text-2xl font-bold leading-none tabular-nums text-fg">{Math.round(m.match_score)}</span>
                  <span className="text-xs text-fg-2">match</span>
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-fg-2">Rate</dt><dd className="tabular-nums text-fg">${m.hourly_rate}/hr</dd>
                <dt className="text-fg-2">Experience</dt><dd className="tabular-nums text-fg">{m.experience_years} yrs</dd>
                <dt className="text-fg-2">Rating</dt>
                <dd className="tabular-nums text-fg">{m.review_count > 0 ? `${m.rating.toFixed(1)} (${m.review_count})` : 'No reviews'}</dd>
                <dt className="text-fg-2">Skills</dt><dd className="text-fg">{m.skills?.join(', ')}</dd>
              </dl>
              {m.reasoning && (
                <MatchReasoning reasoning={m.reasoning} deterministicScore={m.deterministic_match_score} graph={m.graph} />
              )}
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
