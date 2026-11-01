'use client'

import { useEffect, useState } from 'react'
import { api, FreelancerRecord, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { AlertTriangle, ChevronDown, ShieldCheck } from 'lucide-react'
import { fraudLabel, fraudTone } from '@/lib/utils'
import { signalLabel } from '@/lib/fraudSignals'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, LoadingRows, Notice, Spinner } from '@/components/ui/States'

interface QueueItem extends FreelancerRecord {
  fraudDetails?: FraudResponse
  expanded?: boolean
}

export default function FraudQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadQueue = async () => {
    try {
      const res = await api.freelancers.list(undefined, true)
      // Sort by fraud score descending
      const items = (res.freelancers || [])
        .map(item => ({ ...item, expanded: false }))
        .sort((a, b) => b.fraud_score - a.fraud_score)
      
      setQueue(items)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load fraud queue:', err)
      setLoadFailed(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const toggleRow = async (id: number) => {
    setError(null)
    setQueue(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, expanded: !item.expanded }
      }
      return item
    }))

    const matched = queue.find(item => item.id === id)
    if (matched && !matched.fraudDetails) {
      try {
        const details = await api.fraud.get(id)
        setQueue(prev => prev.map(item => {
          if (item.id === id) {
            return { ...item, fraudDetails: details }
          }
          return item
        }))
      } catch (err: unknown) {
        console.error(err)
        setError(`The fraud analysis for freelancer #${id} didn’t load. Collapse and expand the row to retry.`)
      }
    }
  }

  const handleFlagAction = async (id: number, isFlagged: boolean) => {
    setActionLoading(id)
    setError(null)
    try {
      await api.freelancers.flag(id, isFlagged)
      // Reload queue to reflect cleared flags
      await loadQueue()
      setActionLoading(null)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The flag wasn’t updated. Try again.')
      setActionLoading(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Fraud review"
        description="Profiles the fraud model flagged, highest risk first. Open one to see the signals behind its score, then clear the flag or keep it."
      />
      <PageBody className="max-w-6xl space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {loadFailed && <ErrorState message="The review queue couldn’t be loaded. Refresh the page to try again." />}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card"><LoadingRows rows={4} label="Loading review queue" /></div>
        ) : queue.length === 0 ? (
          !loadFailed && (
            <EmptyState icon={<ShieldCheck aria-hidden />} title="Nothing to review" description="No profiles are flagged right now. New flags appear here as the model scores accounts." />
          )
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            {queue.map(item => {
              const panelId = `fraud-detail-${item.id}`
              return (
                <li key={item.id}>
                  <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={() => toggleRow(item.id)}
                      aria-expanded={!!item.expanded}
                      aria-controls={panelId}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left"
                    >
                      <ChevronDown className={`h-4 w-4 shrink-0 text-fg-2 transition-transform duration-150 ${item.expanded ? 'rotate-180' : ''}`} aria-hidden />
                      <Avatar name={item.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-fg">{item.name}</span>
                        <span className="flex flex-wrap gap-x-3 text-[13px] text-fg-2">
                          {item.location && <span>{item.location}</span>}
                          <span className="tabular-nums">${item.hourly_rate}/hr</span>
                          <span className="tabular-nums">{item.account_age_days} days old</span>
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-3 pl-7 md:pl-0">
                      <span className="text-xl font-bold tabular-nums text-fg">{Math.round(item.fraud_score * 100)}%</span>
                      <Badge tone={fraudTone(item.fraud_score)}>{fraudLabel(item.fraud_score)}</Badge>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionLoading === item.id}
                          onClick={() => handleFlagAction(item.id, false)}
                          className="btn btn-sm btn-secondary"
                        >
                          {actionLoading === item.id ? <Spinner /> : null} Clear flag
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === item.id}
                          onClick={() => handleFlagAction(item.id, true)}
                          className="btn btn-sm btn-danger"
                        >
                          Keep flagged
                        </button>
                      </div>
                    </div>
                  </div>

                  {item.expanded && (
                    <div id={panelId} className="border-t border-line bg-sunken px-4 py-5 sm:px-5">
                      {item.fraudDetails ? (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
                          <div className="flex justify-center md:justify-start">
                            <FraudGauge score={item.fraudDetails.score} confidence={item.fraudDetails.confidence} size="sm" />
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[13px] font-semibold text-fg">Signals the model detected</p>
                              {item.fraudDetails.signals && item.fraudDetails.signals.length > 0 ? (
                                <ul className="mt-2 space-y-1.5">
                                  {item.fraudDetails.signals.map(sig => (
                                    <li key={sig} className="flex gap-2 text-sm text-fg" title={sig}>
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
                                      {signalLabel(sig)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-sm text-fg-2">No signals triggered; the score comes from stored history.</p>
                              )}
                            </div>
                            {item.fraudDetails.risk_factors?.length > 0 && (
                              <div>
                                <p className="text-[13px] font-semibold text-fg">Risk factors</p>
                                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-fg-2">
                                  {item.fraudDetails.risk_factors.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                            {item.fraudDetails.explanation && (
                              <AIReasoningBox explanation={item.fraudDetails.explanation} title="The model’s explanation" defaultOpen />
                            )}
                          </div>
                        </div>
                      ) : (
                        <p role="status" className="flex items-center gap-2 text-sm text-fg-2"><Spinner /> Loading the analysis</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>
    </>
  )
}
