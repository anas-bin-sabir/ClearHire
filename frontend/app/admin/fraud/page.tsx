'use client'

import { useEffect, useState } from 'react'
import { api, FreelancerRecord, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Flag, 
  User, 
  AlertTriangle,
  FileText
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fraudColor, fraudLabel } from '@/lib/utils'

interface QueueItem extends FreelancerRecord {
  fraudDetails?: FraudResponse
  expanded?: boolean
}

export default function FraudQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      } catch (err: any) {
        console.error(err)
        setError(`Failed to fetch fraud analysis details for freelancer #${id}.`)
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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to update flag status.')
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-rose border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading review queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-5.5 w-5.5 text-rose" /> Fraud Review Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">Approve accounts or keep them flagged. Decisive actions force risk ratings to baseline values.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Flagged Queue Table */}
      <div className="glass-card overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Review queue is clear! No flagged profiles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-12" />
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Risk Score</th>
                  <th className="py-4 px-6">Confidence</th>
                  <th className="py-4 px-6">Location</th>
                  <th className="py-4 px-6">Rate</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-xs text-slate-300">
                {queue.map(item => {
                  const labelStr = fraudLabel(item.fraud_score)
                  const fColor = fraudColor(item.fraud_score)
                  const badgeColors: Record<string, string> = {
                    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    mint: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }

                  return (
                    <>
                      {/* Main Row */}
                      <tr 
                        key={item.id} 
                        onClick={() => toggleRow(item.id)}
                        className="hover:bg-white/1 cursor-pointer transition-colors"
                      >
                        <td className="py-4 px-6">
                          {item.expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </td>
                        <td className="py-4 px-6 font-semibold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded bg-slate-950/40 border border-white/10 flex items-center justify-center text-slate-400">
                              <User className="h-4 w-4 text-rose" />
                            </div>
                            {item.name}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold">
                          <span className={`px-2.5 py-0.5 rounded-full border uppercase text-[10px] ${badgeColors[fColor]}`}>
                            {Math.round(item.fraud_score * 100)}% ({labelStr})
                          </span>
                        </td>
                        <td className="py-4 px-6 uppercase font-mono tracking-wider text-slate-400">
                          {item.fraudDetails?.confidence || 'loading...'}
                        </td>
                        <td className="py-4 px-6 text-slate-400">{item.location || 'Remote'}</td>
                        <td className="py-4 px-6 font-mono">${item.hourly_rate}/hr</td>
                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            <button
                              disabled={actionLoading === item.id}
                              onClick={() => handleFlagAction(item.id, false)}
                              className="btn btn-sm btn-ghost hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              disabled={actionLoading === item.id}
                              onClick={() => handleFlagAction(item.id, true)}
                              className="btn btn-sm btn-danger flex items-center gap-1 cursor-pointer"
                            >
                              <Flag className="h-3.5 w-3.5" /> Keep Flagged
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row details */}
                      <AnimatePresence>
                        {item.expanded && (
                          <tr>
                            <td colSpan={7} className="py-0 bg-slate-950/20">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="p-6 border-b border-white/5"
                              >
                                {item.fraudDetails ? (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                                    {/* Semicircle */}
                                    <div className="md:col-span-1 flex flex-col items-center">
                                      <FraudGauge score={item.fraudDetails.score} confidence={item.fraudDetails.confidence} size="md" />
                                    </div>

                                    {/* Signals */}
                                    <div className="md:col-span-2 space-y-4">
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Triggered Signals</span>
                                        {item.fraudDetails.signals && item.fraudDetails.signals.length > 0 ? (
                                          <div className="flex flex-wrap gap-2">
                                            {item.fraudDetails.signals.map(sig => (
                                              <span 
                                                key={sig}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold uppercase tracking-wider font-mono"
                                              >
                                                <AlertTriangle className="h-3 w-3" /> {sig.replace(/_/g, ' ')}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-slate-500 italic">No signals triggered.</p>
                                        )}
                                      </div>

                                      {/* Reasoning explainer */}
                                      {item.fraudDetails.explanation && (
                                        <div className="pt-2">
                                          <AIReasoningBox 
                                            explanation={item.fraudDetails.explanation}
                                            title="Bayesian Heuristic Details"
                                            defaultOpen={true}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-slate-500 text-xs font-mono">
                                    Retrieving audit trail...
                                  </div>
                                )}
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
