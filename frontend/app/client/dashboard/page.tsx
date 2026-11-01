'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Briefcase, Plus } from 'lucide-react'
import { api, PlatformStatsResponse, ProjectRecord, ActivityFeedItem } from '@/lib/api'
import { StatCard, StatStrip } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { EmptyState, ErrorState, LoadingRows, Skeleton } from '@/components/ui/States'
import { ActivityList } from '@/components/ui/ActivityList'
import { fmt } from '@/lib/utils'

export default function ClientDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

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
        setError(null)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        if (active) {
          setError('Projects and activity couldn’t be fetched from the ClearHire API.')
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [session, reloadKey])

  const firstName = session?.user?.name?.split(' ')[0]
  const open = projects.filter(p => p.status === 'open').length

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="Your projects, their matches, and what changed on the platform."
        actions={
          <Link href="/client/projects/new" className="btn btn-primary">
            <Plus aria-hidden /> Post a project
          </Link>
        }
      />
      <PageBody className="space-y-6">
        {error && (
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true)
              setReloadKey(k => k + 1)
            }}
          />
        )}

        {loading ? (
          <Skeleton className="h-[106px] w-full rounded-panel" />
        ) : (
          stats && (
            <StatStrip>
              <StatCard label="Your open projects" value={open} description={`${projects.length} posted in total`} />
              <StatCard label="Talent network" value={stats.freelancers_total} description="Freelancers you can match against" />
              <StatCard label="Teams built" value={stats.teams_built} description="Across the platform" />
              <StatCard
                label="Flagged for review"
                value={stats.fraud_flagged}
                tone={stats.fraud_flagged > 0 ? 'danger' : 'default'}
                description="Profiles held back from matching"
              />
            </StatStrip>
          )
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Your projects" description="Open a project to see its ranked candidates." flush>
            {loading ? (
              <div className="p-5"><LoadingRows rows={3} label="Loading projects" /></div>
            ) : projects.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Briefcase aria-hidden />}
                  title="No projects yet"
                  description="Describe what you need in plain language. ClearHire extracts the skills and budget, then ranks freelancers for it."
                  action={
                    <Link href="/client/projects/new" className="btn btn-sm btn-secondary">
                      <Plus aria-hidden /> Post your first project
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {projects.map(proj => (
                  <li key={proj.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-fg">{proj.title || `Project #${proj.id}`}</h3>
                        <StatusBadge status={proj.status} />
                      </div>
                      {proj.description && (
                        <p className="mt-1 line-clamp-1 text-[13px] text-fg-2">{proj.description.replace(/Client: .*\n\n/, '')}</p>
                      )}
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                        <div className="flex gap-1.5"><dt className="text-fg-2">Budget</dt><dd className="font-semibold tabular-nums text-fg">{fmt.currency(proj.budget)}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-fg-2">Team</dt><dd className="font-semibold tabular-nums text-fg">{proj.team_size}</dd></div>
                        {proj.deadline_days ? (
                          <div className="flex gap-1.5"><dt className="text-fg-2">Deadline</dt><dd className="font-semibold tabular-nums text-fg">{proj.deadline_days} days</dd></div>
                        ) : null}
                      </dl>
                    </div>
                    <Link href={`/client/search?projectId=${proj.id}`} className="btn btn-sm btn-secondary shrink-0">
                      View matches
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Platform activity" description="Recent searches, contracts and reviews." flush>
            <div className="max-h-[480px] overflow-y-auto">
              {loading ? (
                <div className="p-5"><LoadingRows rows={4} label="Loading activity" /></div>
              ) : (
                <ActivityList items={feed.slice(0, 15)} />
              )}
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  )
}
