'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api, PlatformStatsResponse, ProjectRecord, ActivityFeedItem } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { 
  Users, 
  Briefcase, 
  ShieldAlert, 
  Boxes, 
  Plus, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'
import { fmt } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
}

export default function ClientDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadData = async () => {
      try {
        const [s, p, f] = await Promise.all([
          api.stats(),
          api.projects.list(),
          api.activity.feed()
        ])
        if (!active) return

        setStats(s)
        
        // Filter projects created by the logged in client
        const clientName = session?.user?.name || 'Sara Ahmed'
        const filtered = p.projects.filter(
          item => item.client?.toLowerCase() === clientName.toLowerCase()
        )
        setProjects(filtered)
        setFeed(f.items || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
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
          <div className="h-8 w-8 rounded-full border-2 border-electric border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Assembling your workspace...</p>
        </div>
      </div>
    )
  }

  const clientName = session?.user?.name || 'Sara Ahmed'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Welcome Header */}
      <div className="flex justify-between items-center bg-radial from-slate-900/50 via-slate-950/20 to-transparent p-6 rounded-2xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Welcome back, {clientName} <Sparkles className="h-5 w-5 text-indigo-400" />
          </h2>
          <p className="text-sm text-slate-400 mt-1">Hire talent and manage teams with Bayesian trust verification and constraint optimization.</p>
        </div>
        <Link 
          href="/client/projects/new" 
          className="btn btn-md btn-primary relative z-10 shadow-lg shadow-electric/25 flex items-center gap-2 hover:scale-102 transition-transform cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Post a Project
        </Link>
        <div className="absolute top-0 right-0 w-64 h-64 bg-electric/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 Stat Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Total Talent Network" 
            value={stats?.freelancers_total || 0} 
            icon={Users} 
            color="electric" 
            description="Verified network candidates"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Your Open Jobs" 
            value={projects.filter(p => p.status === 'open').length} 
            icon={Briefcase} 
            color="mint" 
            description={`Out of ${projects.length} total projects`}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Fraud Risk Alerts" 
            value={stats?.fraud_flagged || 0} 
            icon={ShieldAlert} 
            color="rose" 
            description="Active review queue items"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Teams Generated" 
            value={stats?.teams_built || 0} 
            icon={Boxes} 
            color="amber" 
            description="Constraint optimized teams"
          />
        </motion.div>
      </motion.div>

      {/* Main Split Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 cols: Client Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-400" /> Your Active Projects
            </h3>
            <span className="text-xs font-mono bg-slate-900 border border-white/5 text-slate-400 px-2.5 py-1 rounded-lg">
              {projects.length} Total
            </span>
          </div>

          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="glass-card p-12 text-center border-dashed flex flex-col items-center justify-center">
                <Briefcase className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm mb-4">You haven't posted any projects yet.</p>
                <Link 
                  href="/client/projects/new" 
                  className="btn btn-sm btn-ghost inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Post First Project
                </Link>
              </div>
            ) : (
              projects.map((proj, idx) => (
                <motion.div 
                  key={proj.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-500/20"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-white text-base truncate">{proj.title}</h4>
                      <StatusBadge status={proj.status} />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description?.replace(/Client: .*\n\n/, '') || 'No description provided.'}
                    </p>
                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-medium">
                      <span>Budget: <strong className="text-white">{fmt.currency(proj.budget)}</strong></span>
                      <span>Team Size: <strong className="text-white">{proj.team_size} members</strong></span>
                      {proj.deadline_days && <span>Deadline: <strong className="text-white">{proj.deadline_days} days</strong></span>}
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto items-stretch">
                    <Link 
                      href={`/client/search?projectId=${proj.id}`}
                      className="btn btn-sm btn-primary justify-center gap-1 flex-1 md:flex-initial cursor-pointer"
                    >
                      Search Matches <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 col: Activity Feed */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-400" /> Platform Feed
            </h3>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              Live
            </span>
          </div>

          <div className="glass-card p-6 space-y-4 max-h-[500px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No recent activity.
              </div>
            ) : (
              feed.slice(0, 15).map((item, idx) => (
                <div key={item.id || idx} className="flex gap-3 text-xs leading-relaxed border-b border-white/3 pb-3 last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 font-medium break-words">{item.text}</p>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      {fmt.timeAgo(item.time)}
                    </span>
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
