'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ProjectRecord, FreelancerRecord } from '@/lib/api'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import { 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  DollarSign, 
  Calendar, 
  Award, 
  BookmarkCheck,
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface MatchProject extends ProjectRecord {
  matchPct: number
  overlap: string[]
  isInterested?: boolean
}

export default function MatchesPage() {
  const { data: session } = useSession()
  const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

  const [matches, setMatches] = useState<MatchProject[]>([])
  const [loading, setLoading] = useState(true)
  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter list of ignored project ids
  const [ignoredIds, setIgnoredIds] = useState<number[]>([])

  useEffect(() => {
    let active = true

    const loadMatches = async () => {
      try {
        const [fl, pRes, cRes] = await Promise.all([
          api.freelancers.get(flId),
          api.projects.list(),
          api.contracts.byFreelancer(flId)
        ])

        const mySkills = fl.skills || []
        const openProjects = pRes.projects.filter(p => p.status === 'open')

        // Already applied project ids
        const appliedProjectIds = (cRes.contracts || []).map(c => c.project_id)

        const mapped: MatchProject[] = openProjects
          .map(p => {
            const overlap = (p.required_skills || []).filter(s => mySkills.includes(s))
            const matchPct = p.required_skills && p.required_skills.length > 0 
              ? Math.round((overlap.length / p.required_skills.length) * 100)
              : 0

            return {
              ...p,
              matchPct,
              overlap,
              isInterested: appliedProjectIds.includes(p.id)
            }
          })
          .sort((a, b) => b.matchPct - a.matchPct)

        if (active) {
          setFreelancer(fl)
          setMatches(mapped)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load project matches:', err)
        if (active) setLoading(false)
      }
    }

    loadMatches()
    return () => {
      active = false
    }
  }, [flId])

  const handleExpressInterest = async (pId: number) => {
    setActionLoading(pId)
    setError(null)
    setSuccessMsg(null)
    try {
      await api.contracts.create({
        freelancer_id: flId,
        project_id: pId,
        status: 'pending' // Expressing interest sets contract status to pending
      })
      setSuccessMsg('Interest submitted! The client will review your profile.')
      setMatches(prev => 
        prev.map(m => m.id === pId ? { ...m, isInterested: true } : m)
      )
      setActionLoading(null)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to submit interest.')
      setActionLoading(null)
    }
  }

  const handleIgnore = (pId: number) => {
    setIgnoredIds(prev => [...prev, pId])
  }

  const visibleMatches = matches.filter(m => !ignoredIds.includes(m.id))

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-mint border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Matching your skills with open roles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5.5 w-5.5 text-mint" /> Smart Matching Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Projects sorted by skill similarity. Express interest to trigger contract allocation.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <BookmarkCheck className="h-5 w-5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {visibleMatches.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-500 text-sm">
              No new matching projects found. Check back later!
            </div>
          ) : (
            visibleMatches.map((proj, idx) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-mint/20"
              >
                <div className="space-y-3 flex-1 min-w-0">
                  {/* Title & Match percentage */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="font-bold text-white text-base truncate">{proj.title}</h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mint/10 text-mint border border-mint/20">
                      {proj.matchPct}% Skill Overlap
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {proj.description?.replace(/Client: .*\n\n/, '') || 'No description provided.'}
                  </p>

                  {/* Skills lists highlighting overlap */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(proj.required_skills || []).map(skill => {
                      const matched = freelancer?.skills?.includes(skill)
                      return (
                        <SkillBadge key={skill} skill={skill} highlighted={matched} />
                      )
                    })}
                  </div>

                  {/* Details stats */}
                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-medium font-mono pt-1">
                    <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Budget: <strong className="text-white">${proj.budget}</strong></span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Deadline: <strong className="text-white">{proj.deadline_days} days</strong></span>
                    <span>Client: <strong className="text-white">{proj.client || 'Sara Ahmed'}</strong></span>
                  </div>
                </div>

                {/* Actions side */}
                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto items-stretch border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                  {proj.isInterested ? (
                    <div className="text-center py-2 px-6 bg-slate-950/40 rounded-lg border border-white/5 flex items-center justify-center text-xs text-slate-500 italic">
                      Applied
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={actionLoading === proj.id}
                        onClick={() => handleExpressInterest(proj.id)}
                        className="btn btn-sm btn-primary bg-mint hover:bg-emerald-400 border-none text-ink font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {actionLoading === proj.id ? 'Sending...' : 'Express Interest'}
                      </button>
                      <button
                        onClick={() => handleIgnore(proj.id)}
                        className="btn btn-sm btn-ghost flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> Ignore
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
