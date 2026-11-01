'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, PlatformStatsResponse, HealthResponse, ActivityFeedItem } from '@/lib/api'
import { StatCard, StatStrip } from '@/components/ui/StatCard'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { ActivityList } from '@/components/ui/ActivityList'
import { ErrorState, LoadingRows, Skeleton } from '@/components/ui/States'

function ServiceRow({ name, status, okLabel = 'Connected' }: { name: string; status: string | undefined; okLabel?: string }) {
  const ok = status?.toLowerCase() === 'ok'
  const label = !status ? 'No response' : ok ? okLabel : status
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-medium text-fg">{name}</span>
      <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${ok ? 'text-ok' : 'text-danger'}`}>
        <span aria-hidden className={`h-2 w-2 rounded-full ${ok ? 'bg-teal' : 'bg-danger'}`} />
        <span className="max-w-40 truncate" title={label}>{label}</span>
      </span>
    </li>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

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
        if (active) {
          setFailed(true)
          setLoading(false)
        }
      }
    }

    loadAdminData()
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <PageHeader
        title="Admin console"
        description="Platform health, the fraud review queue, and what’s happening across ClearHire."
        actions={
          stats && stats.fraud_flagged > 0 ? (
            <Link href="/admin/fraud" className="btn btn-primary">Review {stats.fraud_flagged} flagged</Link>
          ) : undefined
        }
      />
      <PageBody className="space-y-6">
        {failed && <ErrorState message="Stats, health or activity couldn’t be loaded. The API may be down; check the service status below after refreshing." />}

        {loading ? (
          <Skeleton className="h-[106px] rounded-panel" />
        ) : stats ? (
          <StatStrip>
            <StatCard label="Freelancers" value={stats.freelancers_total} />
            <StatCard label="Projects" value={stats.projects_total ?? '—'} description={`${stats.open_projects} open`} />
            <StatCard label="Teams built" value={stats.teams_built} />
            <StatCard label="Flagged for review" value={stats.fraud_flagged} tone={stats.fraud_flagged > 0 ? 'danger' : 'default'} />
          </StatStrip>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Activity" description="Searches, contracts and fraud reviews across the platform." flush>
            <div className="max-h-[440px] overflow-y-auto">
              {loading ? <div className="p-5"><LoadingRows rows={4} label="Loading activity" /></div> : <ActivityList items={feed} />}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Services" description="From the API’s health check.">
              {loading ? (
                <LoadingRows rows={2} label="Checking services" />
              ) : (
                <ul className="-my-2.5 divide-y divide-line">
                  <ServiceRow name="PostgreSQL" status={health?.postgres} />
                  <ServiceRow name="MongoDB" status={health?.mongodb} />
                  <ServiceRow name="Neo4j graph" status={health?.neo4j} />
                  <ServiceRow name="Language model key" status={health ? (health.anthropic_configured ? 'ok' : 'Not configured') : undefined} okLabel={health?.llm_provider === 'gemini' ? 'Gemini' : health?.llm_provider === 'claude' ? 'Claude' : 'Configured'} />
                </ul>
              )}
            </Panel>
            <p className="px-1 text-[13px] leading-relaxed text-fg-2">
              Without a Gemini or Anthropic key, project briefs fall back to the rule-based parser and search skips the AI rerank.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  )
}
