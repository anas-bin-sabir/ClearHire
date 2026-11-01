'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ProjectRecord, FreelancerRecord } from '@/lib/api'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { fmt } from '@/lib/utils'
import { Check, Zap } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingRows, Notice } from '@/components/ui/States'

interface MatchProject extends ProjectRecord {
  matchPct: number
  overlap: string[]
  isInterested?: boolean
}

export default function MatchesPage() {
  const { data: session } = useSession()
  const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

  const [matches, setMatches] = useState<MatchProject[]>([])
  const [loading, setLoading] = useState(true)
  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

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
        if (active) {
          setLoadFailed(true)
          setLoading(false)
        }
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
      setSuccessMsg('Interest sent. A pending contract was created for the client to review.')
      setMatches(prev => 
        prev.map(m => m.id === pId ? { ...m, isInterested: true } : m)
      )
      setActionLoading(null)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'Your interest wasn’t sent. Try again.')
      setActionLoading(null)
    }
  }

  const handleIgnore = (pId: number) => {
    setIgnoredIds(prev => [...prev, pId])
  }

  const visibleMatches = matches.filter(m => !ignoredIds.includes(m.id))

  return (
    <>
      <PageHeader
        title="Project matches"
        description="Open projects ordered by how many of their required skills you have. Express interest to send the client a pending contract."
      />
      <PageBody className="max-w-5xl space-y-4">
        {successMsg && <Notice tone="ok">{successMsg}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {loadFailed && <ErrorState message="Open projects couldn’t be loaded. Refresh the page to try again." />}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card">
            <LoadingRows rows={4} label="Loading project matches" />
          </div>
        ) : visibleMatches.length === 0 ? (
          !loadFailed && (
            <EmptyState
              icon={<Zap aria-hidden />}
              title={matches.length === 0 ? 'No open projects right now' : 'You’ve hidden every match'}
              description={
                matches.length === 0
                  ? 'New projects appear here as clients post them. Adding skills to your profile widens what you match.'
                  : 'Reload the page to see hidden projects again.'
              }
            />
          )
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            {visibleMatches.map(proj => (
              <li key={proj.id} className="flex flex-col gap-4 px-5 py-5 sm:px-6 md:flex-row md:items-start">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="text-base font-semibold text-fg">{proj.title}</h2>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold tabular-nums text-teal-ink">{proj.matchPct}%</span>
                      <span className="text-xs text-fg-2">skill overlap</span>
                    </p>
                  </div>
                  {proj.description && (
                    <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-fg-2">
                      {proj.description.replace(/Client: .*\n\n/, '')}
                    </p>
                  )}
                  <ul className="flex flex-wrap gap-1.5" aria-label="Required skills (yours highlighted)">
                    {(proj.required_skills || []).map(skill => (
                      <li key={skill}><SkillBadge skill={skill} highlighted={freelancer?.skills?.includes(skill)} /></li>
                    ))}
                  </ul>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                    <div className="flex gap-1.5"><dt className="text-fg-2">Budget</dt><dd className="font-semibold tabular-nums text-fg">{fmt.currency(proj.budget)}</dd></div>
                    {proj.deadline_days ? <div className="flex gap-1.5"><dt className="text-fg-2">Deadline</dt><dd className="font-semibold tabular-nums text-fg">{proj.deadline_days} days</dd></div> : null}
                    {proj.client && <div className="flex gap-1.5"><dt className="text-fg-2">Client</dt><dd className="font-semibold text-fg">{proj.client}</dd></div>}
                  </dl>
                </div>

                <div className="flex shrink-0 gap-2 md:w-44 md:flex-col">
                  {proj.isInterested ? (
                    <p className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-control bg-teal-tint text-sm font-semibold text-teal-ink">
                      <Check className="h-4 w-4" aria-hidden /> Interest sent
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === proj.id}
                        onClick={() => handleExpressInterest(proj.id)}
                        className="btn btn-primary flex-1"
                      >
                        {actionLoading === proj.id ? 'Sending…' : 'Express interest'}
                      </button>
                      <button type="button" onClick={() => handleIgnore(proj.id)} className="btn btn-ghost flex-1">
                        Hide
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </PageBody>
    </>
  )
}
