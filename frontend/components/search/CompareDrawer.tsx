'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Scale } from 'lucide-react'
import type { MatchComparison, RankedMatch, RerankingInfo } from '@/lib/api'
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
  const comparison = first && second
    ? comparisonFor(reranking?.comparisons ?? [], first.id, second.id)
    : undefined

  return (
    <AnimatePresence>
      {open && first && second && (
        <>
          <motion.div
            className="fixed inset-0 bg-slate-950/70 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-slate-950 border-l border-white/5 z-50 overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Compare top matches"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                <Scale className="h-4 w-4 text-electric" /> Compare top 2
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {comparison && (
                <div className="rounded-xl border border-electric/20 bg-electric/5 p-4">
                  <p className="text-sm text-slate-200 leading-relaxed">{comparison.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {comparison.evidence.map(ref => (
                      <span key={ref} title={ref} className="px-1.5 py-px rounded bg-white/5 text-[10px] font-mono text-slate-400">
                        {ref.match(/^f(\d+)/)?.[1] === String(first.id) ? first.name : second.name}: {evidenceLabel(ref)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[first, second].map((m, i) => (
                  <div key={m.id} className="glass-card p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-white">#{i + 1} {m.name}</span>
                      <span className="text-xs font-mono text-electric">{Math.round(m.match_score)}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px] text-slate-400">
                      <dt>Rate</dt><dd className="text-slate-200">${m.hourly_rate}/h</dd>
                      <dt>Experience</dt><dd className="text-slate-200">{m.experience_years} yrs</dd>
                      <dt>Rating</dt><dd className="text-slate-200">{m.rating?.toFixed(1)}</dd>
                      <dt>Skills</dt><dd className="text-slate-200">{m.skills?.join(', ')}</dd>
                    </dl>
                    {m.reasoning && (
                      <MatchReasoning reasoning={m.reasoning} deterministicScore={m.deterministic_match_score} />
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 font-mono">
                {reranking?.path === 'llm'
                  ? `AI rerank of the top ${reranking.top_n}, blended ${Math.round(reranking.alpha * 100)}% ranker / ${Math.round((1 - reranking.alpha) * 100)}% AI fit${reranking.cached ? ' (cached)' : ''}.`
                  : 'Deterministic ranking; AI rerank unavailable for this search.'}
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
