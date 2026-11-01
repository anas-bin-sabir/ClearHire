'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api, FreelancerRecord, ContractRecord, ActivityFeedItem } from '@/lib/api'
import { StatCard, StatStrip } from '@/components/ui/StatCard'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { ActivityList } from '@/components/ui/ActivityList'
import { EmptyState, ErrorState, LoadingRows, Skeleton } from '@/components/ui/States'
import { fmt, fraudLabel } from '@/lib/utils'
import { FileText } from 'lucide-react'

interface DashboardContract extends ContractRecord {
  projectTitle: string
  hours: number
}

/** Hours on a project record, when the backend includes them; 40 otherwise (unchanged default). */
function projectHours(proj: object): number {
  const value = (proj as { hours_per_member?: unknown }).hours_per_member
  return typeof value === 'number' && value > 0 ? value : 40
}

export default function FreelancerDashboard() {
  const { data: session } = useSession()
  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [contracts, setContracts] = useState<DashboardContract[]>([])
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [potentialEarnings, setPotentialEarnings] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

    const loadData = async () => {
      try {
        const [fl, cRes, fRes] = await Promise.all([
          api.freelancers.get(flId),
          api.contracts.byFreelancer(flId),
          api.activity.feed()
        ])

        // Resolve projects for active contracts to sum potential earnings
        // sum (hourly_rate * project.hours_per_member or 40)
        let sum = 0
        const enrichedContracts = await Promise.all(
          (cRes.contracts || []).map(async c => {
            try {
              const proj = await api.projects.get(c.project_id)
              const hours = projectHours(proj)
              if (c.status === 'active') {
                sum += fl.hourly_rate * hours
              }
              return {
                ...c,
                projectTitle: proj.title || `Project #${c.project_id}`,
                hours
              }
            } catch {
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
        if (active) {
          setError('Your profile and contracts couldn’t be fetched from the ClearHire API. Refresh to try again.')
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [session])

  const activeContractsCount = contracts.filter(c => c.status === 'active').length
  const firstName = freelancer?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="Your contracts, how clients see your rate, and your trust standing."
        actions={
          <>
            <Link href="/freelancer/profile/edit" className="btn btn-secondary">Edit profile</Link>
            <Link href="/freelancer/matches" className="btn btn-primary">See project matches</Link>
          </>
        }
      />
      <PageBody className="space-y-6">
        {error && <ErrorState message={error} />}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {loading ? (
            <Skeleton className="h-[106px] rounded-panel" />
          ) : (
            <StatStrip>
              <StatCard
                label="Active contract value"
                value={fmt.currency(potentialEarnings)}
                description="Your rate × hours on each active contract"
              />
              <StatCard label="Active contracts" value={activeContractsCount} description={`${contracts.length} in total`} />
              <StatCard
                label="Hourly rate"
                value={freelancer ? fmt.rate(freelancer.hourly_rate) : '—'}
                description={freelancer ? `${fmt.currency(freelancer.hourly_rate * 160)} at 160 hours a month` : undefined}
              />
            </StatStrip>
          )}

          <Panel
            className="xl:row-span-2"
            title="Trust score"
            description="How ClearHire’s fraud model rates your account. Clients see this as a signal."
            actions={<Link href="/freelancer/trust-score" className="btn btn-sm btn-ghost text-primary-ink">Details</Link>}
          >
            {loading ? (
              <Skeleton className="mx-auto h-24 w-40" />
            ) : freelancer ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <FraudGauge score={freelancer.fraud_score} />
                <p className="max-w-[16rem] text-[13px] text-fg-2">
                  Rated <span className="font-semibold text-fg">{fraudLabel(freelancer.fraud_score).toLowerCase()}</span>. The trust score page lists the signals behind it.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel title="Your contracts" flush className="min-w-0">
            {loading ? (
              <div className="p-5"><LoadingRows rows={3} label="Loading contracts" /></div>
            ) : contracts.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<FileText aria-hidden />}
                  title="No contracts yet"
                  description="When a client hires you, the contract shows up here."
                  action={<Link href="/freelancer/matches" className="btn btn-sm btn-secondary">See project matches</Link>}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Project</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">Hours</th>
                      <th scope="col" className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map(c => (
                      <tr key={c.id}>
                        <td className="font-semibold text-fg">{c.projectTitle}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td className="text-right tabular-nums text-fg-2">{c.hours}</td>
                        <td className="text-right font-semibold tabular-nums text-fg">
                          {freelancer ? fmt.currency(freelancer.hourly_rate * c.hours) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Platform activity" flush>
          <div className="max-h-80 overflow-y-auto">
            {loading ? <div className="p-5"><LoadingRows rows={3} label="Loading activity" /></div> : <ActivityList items={feed.slice(0, 8)} />}
          </div>
        </Panel>
      </PageBody>
    </>
  )
}
