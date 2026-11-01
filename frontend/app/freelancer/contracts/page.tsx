'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api, ContractRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import { FileText } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, LoadingRows, Notice } from '@/components/ui/States'

interface EnrichedContract extends ContractRecord {
  projectTitle: string
  budget: number
}

export default function FreelancerContractsPage() {
  const { data: session } = useSession()
  const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

  const [contracts, setContracts] = useState<EnrichedContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hourlyRate, setHourlyRate] = useState<number>(0)

  useEffect(() => {
    let active = true

    const loadContracts = async () => {
      try {
        const [fl, cRes] = await Promise.all([
          api.freelancers.get(flId),
          api.contracts.byFreelancer(flId)
        ])

        setHourlyRate(fl.hourly_rate)

        const flatContracts = cRes.contracts || []

        // Fetch project details for each contract
        const enriched: EnrichedContract[] = await Promise.all(
          flatContracts.map(async c => {
            try {
              const proj = await api.projects.get(c.project_id)
              return {
                ...c,
                projectTitle: proj.title || `Project #${c.project_id}`,
                budget: proj.budget
              }
            } catch {
              return {
                ...c,
                projectTitle: `Project #${c.project_id}`,
                budget: 0
              }
            }
          })
        )

        if (active) {
          setContracts(enriched)
          setLoading(false)
        }
      } catch (err: unknown) {
        console.error(err)
        if (active) {
          setError('Your contracts couldn’t be loaded. Refresh the page to try again.')
          setLoading(false)
        }
      }
    }

    loadContracts()
    return () => {
      active = false
    }
  }, [flId])

  const created = (c: EnrichedContract) => (c.created_at ? new Date(c.created_at).toLocaleDateString() : '—')

  return (
    <>
      <PageHeader title="Contracts" description="Every contract you’ve been hired into or expressed interest in. Clients change the status." />
      <PageBody className="max-w-5xl space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card"><LoadingRows rows={4} label="Loading contracts" /></div>
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden />}
            title="No contracts yet"
            description="Express interest in a project, or wait for a client to hire you."
            action={<Link href="/freelancer/matches" className="btn btn-sm btn-secondary">See project matches</Link>}
          />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            <table className="data-table hidden md:table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Your rate</th>
                  <th scope="col" className="text-right">Project budget</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(contract => (
                  <tr key={contract.id}>
                    <td className="font-semibold text-fg">{contract.projectTitle}</td>
                    <td><StatusBadge status={contract.status} /></td>
                    <td className="text-right tabular-nums text-fg">{fmt.rate(hourlyRate)}</td>
                    <td className="text-right tabular-nums text-fg">{fmt.currency(contract.budget)}</td>
                    <td className="tabular-nums text-fg-2">{created(contract)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {contracts.map(contract => (
                <li key={contract.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-fg">{contract.projectTitle}</p>
                    <StatusBadge status={contract.status} />
                  </div>
                  <p className="flex flex-wrap gap-x-4 text-[13px] text-fg-2">
                    <span className="tabular-nums">{fmt.rate(hourlyRate)}</span>
                    <span className="tabular-nums">Budget {fmt.currency(contract.budget)}</span>
                    <span className="tabular-nums">Created {created(contract)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageBody>
    </>
  )
}
