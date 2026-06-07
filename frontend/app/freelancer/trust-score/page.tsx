'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  TrendingUp,
  XCircle,
  FileText
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function TrustScorePage() {
  const { data: session } = useSession()
  const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

  const [fraud, setFraud] = useState<FraudResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadFraud = async () => {
      try {
        const res = await api.fraud.get(flId)
        if (active) {
          setFraud(res)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load trust index score:', err)
        if (active) setLoading(false)
      }
    }
    loadFraud()
    return () => {
      active = false
    }
  }, [flId])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-mint border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Assembling trust indices...</p>
        </div>
      </div>
    )
  }

  const SIGNALS = [
    { key: 'low_account_age', label: 'Account age sufficient (>30 days)' },
    { key: 'low_rating', label: 'Rating above 3.0 stars' },
    { key: 'no_portfolio', label: 'Portfolio web links supplied' },
    { key: 'low_review_count', label: 'Received reviewer feedback' },
    { key: 'high_rate', label: 'Hourly rate fits market range' }
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5.5 w-5.5 text-mint" /> Bayesian Trust Metrics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit log analyzing profile parameters to calculate platform risk ratings.
          </p>
        </div>
        <AgentStatusBadge 
          entityType="freelancer"
          entityId={flId}
          pipeline="fraud_detection"
        />
      </div>

      {fraud?.is_flagged && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertTriangle className="h-5.5 w-5.5 shrink-0 animate-bounce" />
          <div>
            <h4 className="font-bold">Account flagged for review</h4>
            <p className="text-xs text-rose-400/80 mt-0.5">Your profile declarations have exceeded standard risk threshold triggers. An administrator will review your account soon.</p>
          </div>
        </div>
      )}

      {/* Main split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Semicircle risk gauge */}
        <div className="glass-card p-6 md:col-span-1 flex flex-col items-center justify-center">
          {fraud && (
            <div className="space-y-4 flex flex-col items-center text-center">
              <FraudGauge score={fraud.score} confidence={fraud.confidence} size="lg" />
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Platform Score</span>
                <div className="text-2xl font-bold text-white mt-1">{(fraud.score * 100).toFixed(0)}% Risk</div>
              </div>
            </div>
          )}
        </div>

        {/* Signals Passes / Fails checklist */}
        <div className="glass-card p-6 md:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-3">
            <CheckCircle2 className="h-4.5 w-4.5 text-mint" /> Audit checklist
          </h3>

          <div className="space-y-3">
            {SIGNALS.map(s => {
              const triggered = fraud?.signals?.includes(s.key)
              return (
                <div key={s.key} className="flex justify-between items-center p-3 rounded-xl bg-slate-950/20 border border-white/3">
                  <span className="text-xs text-slate-300 font-medium">{s.label}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    triggered 
                      ? 'bg-rose-500/10 text-rose-400' 
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {triggered ? '✗ Alert' : '✓ Pass'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Risk Factors Explanation */}
      {fraud?.risk_factors && fraud.risk_factors.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-3">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-400" /> Active Risk Factors
          </h3>
          <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            {fraud.risk_factors.map((factor, idx) => (
              <li key={idx} className="marker:text-rose-500">{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvement advice box */}
      {fraud?.explanation && (
        <div className="pt-2">
          <AIReasoningBox 
            explanation={fraud.explanation}
            title="Mitigation Suggestions & AI Feedback"
            defaultOpen={true}
          />
        </div>
      )}
    </div>
  )
}
