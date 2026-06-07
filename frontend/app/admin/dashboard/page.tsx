'use client'

import { useEffect, useState } from 'react'
import { api, PlatformStatsResponse, HealthResponse, ActivityFeedItem } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { 
  Users, 
  Briefcase, 
  ShieldAlert, 
  Boxes, 
  Activity, 
  Database,
  CheckCircle,
  XCircle,
  FileText,
  Clock
} from 'lucide-react'
import { motion } from 'framer-motion'
import { fmt } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadAdminData = async () => {
      try {
        const [s, h, f] = await Promise.all([
          api.stats(),
          api.health(),
          api.activity.feed()
        ])

        if (!active) return

        setStats(s)
        setHealth(h)
        setFeed(f.items || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load admin dashboard:', err)
        if (active) setLoading(false)
      }
    }

    loadAdminData()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-rose border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Assembling administrator suite...</p>
        </div>
      </div>
    )
  }

  // Health lights helpers
  const getLight = (statusStr: string | undefined) => {
    if (!statusStr) return { color: 'bg-slate-500 shadow-slate-500/20', text: 'Disconnected' }
    if (statusStr.toLowerCase() === 'ok') {
      return { color: 'bg-emerald-500 shadow-emerald-500/30', text: 'Connected' }
    }
    return { color: 'bg-rose-500 shadow-rose-500/30', text: statusStr }
  }

  const pgLight = getLight(health?.postgres)
  const mgLight = getLight(health?.mongodb)
  const neoLight = getLight(health?.neo4j)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Header section */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">Console Headquarters</h2>
          <p className="text-sm text-slate-400">Perform health check audits, review fraud risk queues, and observe financial allocations.</p>
        </div>
      </div>

      {/* Database Health row */}
      <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="md:col-span-1 border-r border-white/5 pr-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Database className="h-4 w-4 text-rose" /> Cluster Health
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">Real-time status indicators across datastores.</p>
        </div>
        <div className="md:col-span-3 grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-slate-950/20 p-3 rounded-xl border border-white/3">
            <span className={`h-3 w-3 rounded-full shrink-0 shadow-lg ${pgLight.color}`} />
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">PostgreSQL</span>
              <p className="text-xs text-white font-semibold truncate mt-0.5" title={pgLight.text}>{pgLight.text}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-950/20 p-3 rounded-xl border border-white/3">
            <span className={`h-3 w-3 rounded-full shrink-0 shadow-lg ${mgLight.color}`} />
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">MongoDB</span>
              <p className="text-xs text-white font-semibold truncate mt-0.5" title={mgLight.text}>{mgLight.text}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-950/20 p-3 rounded-xl border border-white/3">
            <span className={`h-3 w-3 rounded-full shrink-0 shadow-lg ${neoLight.color}`} />
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Neo4j Graph</span>
              <p className="text-xs text-white font-semibold truncate mt-0.5" title={neoLight.text}>{neoLight.text}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Stats Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6"
      >
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Total Freelancers"
            value={stats?.freelancers_total || 0}
            icon={Users}
            color="electric"
            description="Verified network profiles"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Projects Created"
            value={stats?.projects_total || 0}
            icon={Briefcase}
            color="mint"
            description="Total client job postings"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Active Open Projects"
            value={stats?.open_projects || 0}
            icon={Briefcase}
            color="amber"
            description="Currently accepting bids"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Risk Alerts Flagged"
            value={stats?.fraud_flagged || 0}
            icon={ShieldAlert}
            color="rose"
            description="Fraud reviews flagged"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Teams Allocations"
            value={stats?.teams_built || 0}
            icon={Boxes}
            color="electric"
            description="CSP resolved configurations"
          />
        </motion.div>
      </motion.div>

      {/* Split section: Activity Logs & Health notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 px-1">
            <Clock className="h-5 w-5 text-rose" /> System Audit Trail
          </h3>

          <div className="glass-card p-6 space-y-4 max-h-[400px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-slate-500 text-xs italic py-12 text-center">
                No recent activity logged.
              </div>
            ) : (
              feed.map((item, idx) => (
                <div key={item.id || idx} className="flex gap-4 text-xs leading-relaxed border-b border-white/3 pb-3 last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-rose shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-semibold truncate-2">{item.text}</p>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">{fmt.timeAgo(item.time)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Configurations Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              LLM Engine Settings
            </h3>
            
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Model Deployment</span>
                <span className="font-mono bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-white font-bold">
                  claude-3-5-haiku
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Anthropic Key Configuration</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  health?.anthropic_configured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {health?.anthropic_configured ? 'Configured' : 'Missing'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-white/3">
                ClearHire utilizes the explanation engine capability to explain search matches and outline Bayesian signals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
