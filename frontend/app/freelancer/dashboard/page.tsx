'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api, FreelancerRecord, ContractRecord, ActivityFeedItem } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import { 
  DollarSign, 
  FileText, 
  ShieldAlert, 
  CheckCircle, 
  Activity, 
  ExternalLink,
  ChevronRight,
  TrendingUp
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function FreelancerDashboard() {
  const { data: session } = useSession()
  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [potentialEarnings, setPotentialEarnings] = useState(0)

  useEffect(() => {
    let active = true
    const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

    const loadData = async () => {
      try {
        const [fl, cRes, fRes] = await Promise.all([
          api.freelancers.get(flId),
          api.contracts.byFreelancer(flId),
          api.activity.feed()
        ])

        const activeContracts = (cRes.contracts || []).filter(c => c.status === 'active')

        // Resolve projects for active contracts to sum potential earnings
        // sum (hourly_rate * project.hours_per_member or 40)
        let sum = 0
        const enrichedContracts = await Promise.all(
          (cRes.contracts || []).map(async c => {
            try {
              const proj = await api.projects.get(c.project_id)
              const hours = (proj as any).hours_per_member || 40
              if (c.status === 'active') {
                sum += fl.hourly_rate * hours
              }
              return {
                ...c,
                projectTitle: proj.title || `Project #${c.project_id}`,
                hours
              }
            } catch (err) {
              if (c.status === 'active') {
                sum += fl.hourly_rate * 40
              }
              return {
                ...c,
                projectTitle: `Project #${c.project_id}`,
                hours: 40
              }
            }
          })
        )

        if (!active) return

        setFreelancer(fl)
        setContracts(enrichedContracts)
        setPotentialEarnings(sum)
        setFeed(fRes.items || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load freelancer dashboard:', err)
        if (active) setLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [session])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-mint border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Assembling your workspace...</p>
        </div>
      </div>
    )
  }

  const activeContractsCount = contracts.filter(c => c.status === 'active').length

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Brand banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back, {freelancer?.name || 'Ali Raza'}</h2>
          <p className="text-sm text-slate-400">Manage your profile declarations, evaluate match parameters, and inspect account safety rankings.</p>
        </div>
        <Link 
          href="/freelancer/profile/edit" 
          className="btn btn-md btn-ghost border-mint/20 hover:border-mint/40 text-mint relative z-10 flex items-center gap-1.5 cursor-pointer"
        >
          Edit Profile <ChevronRight className="h-4 w-4" />
        </Link>
        <div className="absolute top-0 right-0 w-64 h-64 bg-mint/3 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid: Stats & Fraud Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Stat Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
          <StatCard 
            label="Potential Earnings Pipeline"
            value={fmt.currency(potentialEarnings)}
            icon={DollarSign}
            color="mint"
            description="Active contract rates × hours allocation"
          />

          <StatCard 
            label="Active Assignments"
            value={activeContractsCount}
            icon={FileText}
            color="electric"
            description={`Out of ${contracts.length} total contracts`}
          />

          <div className="glass-card p-6 md:col-span-2 flex justify-between items-center bg-slate-900/10 hover:border-white/10">
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Declared rate</span>
              <h3 className="text-xl font-bold text-white">{freelancer ? fmt.rate(freelancer.hourly_rate) : '$0/hr'}</h3>
              <p className="text-xs text-slate-400">Equivalent to {fmt.currency(freelancer ? freelancer.hourly_rate * 160 : 0)} monthly CTC projection.</p>
            </div>
            <Link 
              href="/freelancer/matches" 
              className="btn btn-sm btn-primary bg-mint hover:bg-emerald-400 border-none text-ink font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-mint/20"
            >
              Find Match Jobs <TrendingUp className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right Side: Trust score breakdown */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 flex flex-col items-center justify-between text-center min-h-[280px]">
            <div className="flex justify-between items-center w-full mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-mint" /> Trust Risk Analysis
              </h3>
              <Link href="/freelancer/trust-score" className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-semibold">
                Details <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            
            {freelancer && (
              <div className="space-y-4">
                <FraudGauge score={freelancer.fraud_score} size="md" />
                <p className="text-xs text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                  Your risk rating is {Math.round(freelancer.fraud_score * 100)}%. Keep your profile details and external links updated to reduce risks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid bottom: Contracts table & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 cols: Agreements list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 px-1">
            <FileText className="h-5 w-5 text-mint" /> Contract Commitments
          </h3>

          <div className="glass-card overflow-hidden">
            {contracts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                No contract records found. Check Matches to apply for open project jobs.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-900/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="py-3.5 px-5">Project</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5">Hours</th>
                      <th className="py-3.5 px-5">Potential Yield</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-white/3 text-slate-300">
                    {contracts.map(c => (
                      <tr key={c.id} className="hover:bg-white/1">
                        <td className="py-3.5 px-5 font-semibold text-white">{c.projectTitle}</td>
                        <td className="py-3.5 px-5">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-400">{c.hours} hrs</td>
                        <td className="py-3.5 px-5 font-bold font-mono text-emerald-400">
                          {freelancer ? fmt.currency(freelancer.hourly_rate * c.hours) : '$0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 col: Activity feed */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 px-1">
            <Activity className="h-5 w-5 text-indigo-400" /> Platform Feed
          </h3>

          <div className="glass-card p-6 space-y-4 max-h-[300px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-8">
                No recent feed.
              </div>
            ) : (
              feed.slice(0, 8).map((item, idx) => (
                <div key={item.id || idx} className="flex gap-2 text-xs leading-relaxed border-b border-white/3 pb-2.5 last:border-0 last:pb-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-mint mt-1.5 shrink-0" />
                  <div>
                    <p className="text-slate-300 font-medium break-all">{item.text}</p>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{fmt.timeAgo(item.time)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
