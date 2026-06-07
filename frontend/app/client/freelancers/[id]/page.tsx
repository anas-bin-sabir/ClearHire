'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, FreelancerRecord, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { HireModal } from '@/components/ui/HireModal'
import { fmt } from '@/lib/utils'
import { 
  User, 
  MapPin, 
  Briefcase, 
  ShieldCheck, 
  AlertTriangle, 
  Mail, 
  Link2, 
  Clock, 
  Award,
  Globe,
  BookOpen
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function FreelancerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const freelancerId = Number(params.id)

  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [fraud, setFraud] = useState<FraudResponse | null>(null)
  const [connectedSkills, setConnectedSkills] = useState<string[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showHireModal, setShowHireModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        const [fl, fr, graphRes] = await Promise.all([
          api.freelancers.get(freelancerId),
          api.fraud.get(freelancerId),
          api.graph()
        ])

        if (!active) return

        setFreelancer(fl)
        setFraud(fr)

        // Find connected skill nodes from the D3 graph data
        // Search links where source/target matches freelancer name or id node
        const flNodeId = `F${freelancerId}`
        const connectedNodeIds = graphRes.links
          .filter(l => l.source === flNodeId || l.target === flNodeId)
          .map(l => l.source === flNodeId ? l.target : l.source)

        const skills = graphRes.nodes
          .filter(n => n.type === 'skill' && connectedNodeIds.includes(n.id))
          .map(n => n.name)

        setConnectedSkills(skills)
        setLoading(false)
      } catch (err: any) {
        console.error(err)
        if (active) {
          setError('Failed to load profile details.')
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [freelancerId])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-electric border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading credentials profile...</p>
        </div>
      </div>
    )
  }

  if (!freelancer) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-white">Freelancer Not Found</h3>
        <button onClick={() => router.back()} className="btn btn-md btn-primary">Go Back</button>
      </div>
    )
  }

  // Fraud signals checklist
  const SIGNALS = [
    { key: 'low_account_age', label: 'Account age sufficient (>30 days)' },
    { key: 'low_rating', label: 'Rating above 3.0 stars' },
    { key: 'no_portfolio', label: 'Portfolio web links supplied' },
    { key: 'low_review_count', label: 'Received reviewer feedback' },
    { key: 'high_rate', label: 'Hourly rate fits market range' }
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Profile Info */}
      <div className="glass-card p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-5">
          <div className="h-16 w-16 bg-slate-900 rounded-2xl border border-white/10 flex items-center justify-center text-slate-400">
            <User className="h-8 w-8 text-electric" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">{freelancer.name}</h2>
              <AgentStatusBadge entityType="freelancer" entityId={freelancer.id} pipeline="fraud_detection" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5 font-medium">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {freelancer.location || 'Distributed'}</span>
              <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {freelancer.experience_years} Years Experience</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {freelancer.availability ? 'Available Now' : 'Busy'}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowHireModal(true)}
          className="btn btn-md btn-primary px-8 shadow-lg shadow-electric/25 cursor-pointer shrink-0"
        >
          Hire Freelancer
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Fraud Metrics & Bayesian signals */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 flex flex-col items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2 self-start w-full">
              <ShieldCheck className="h-4.5 w-4.5 text-electric" /> Bayesian Trust Index
            </h3>

            {fraud && (
              <div className="space-y-6 w-full flex flex-col items-center">
                <FraudGauge score={fraud.score} confidence={fraud.confidence} size="lg" />
                
                {fraud.is_flagged && (
                  <div className="w-full p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                    <span>Account is flagged for administrative fraud review.</span>
                  </div>
                )}

                {/* Checklist signals */}
                <div className="w-full space-y-3 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Checklist Evidence</span>
                  {SIGNALS.map(s => {
                    // Check if signal key is inside the active signals list
                    const triggered = fraud.signals?.includes(s.key)
                    return (
                      <div key={s.key} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">{s.label}</span>
                        <span className={`font-mono font-bold ${triggered ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {triggered ? '✗ Alert' : '✓ Pass'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {fraud?.explanation && (
            <AIReasoningBox 
              explanation={fraud.explanation}
              title="Fraud Signal Explanations"
              defaultOpen={true}
            />
          )}
        </div>

        {/* Right Column: Bio, Skills, and Ontologies */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary / Bio */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4.5 w-4.5 text-indigo-400" /> Bio & Background
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {freelancer.bio || "No biography details added. Contact this freelancer for interview requests."}
            </p>

            <div className="grid grid-cols-2 gap-6 border-t border-white/3 pt-5 mt-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Compensation Rate</span>
                <span className="text-base font-bold text-white mt-1 block">${freelancer.hourly_rate}/hr</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Job Success Rating</span>
                <span className="text-base font-bold text-white mt-1 block">{freelancer.rating ? `${(freelancer.rating * 20).toFixed(0)}%` : '0%'} Success</span>
              </div>
            </div>
          </div>

          {/* Portfolio Links */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Globe className="h-4.5 w-4.5 text-indigo-400" /> Portfolios & URLs
            </h3>
            {freelancer.portfolio_urls && freelancer.portfolio_urls.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {freelancer.portfolio_urls.map((url, idx) => (
                  <a 
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 bg-slate-950/20 border border-white/5 rounded-xl hover:border-indigo-500/20 hover:bg-white/2 text-slate-300 hover:text-white"
                  >
                    <Link2 className="h-4 w-4 text-indigo-400" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No external web links added.</p>
            )}
          </div>

          {/* Skills & Graph Node links */}
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-indigo-400" /> Skill Matrix
            </h3>
            
            <div className="space-y-4.5">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Declared Skills</span>
                <div className="flex flex-wrap gap-2">
                  {freelancer.skills?.map(skill => (
                    <SkillBadge key={skill} skill={skill} />
                  ))}
                </div>
              </div>

              {connectedSkills.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Ontology Graph Links (Neo4j)</span>
                  <div className="flex flex-wrap gap-2">
                    {connectedSkills.map(skill => (
                      <span 
                        key={skill}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showHireModal && (
        <HireModal 
          freelancerId={freelancer.id} 
          onSuccess={() => {
            setShowHireModal(false)
            router.push('/client/contracts')
          }}
          onClose={() => setShowHireModal(false)}
        />
      )}
    </div>
  )
}
