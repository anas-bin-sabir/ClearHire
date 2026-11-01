'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ContractRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, LoadingRows, Notice } from '@/components/ui/States'
import { Dialog } from '@/components/ui/Dialog'

interface EnrichedContract extends ContractRecord {
  projectName: string
  freelancerName: string
  hourlyRate: number
}

export default function ClientContractsPage() {
  const { data: session } = useSession()
  const [contracts, setContracts] = useState<EnrichedContract[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<EnrichedContract | null>(null)

  useEffect(() => {
    let active = true
    const clientName = session?.user?.name || 'Sara Ahmed'

    const loadContracts = async () => {
      try {
        const pRes = await api.projects.list()
        // Filter projects belonging to this client
        const myProjs = pRes.projects.filter(
          p => p.client?.toLowerCase() === clientName.toLowerCase()
        )

        // Fetch contracts for all of these projects
        const contractLists = await Promise.all(
          myProjs.map(p => api.contracts.byProject(p.id))
        )

        const flatContracts = contractLists.flatMap(l => l.contracts || [])

        // Fetch freelancer names for unique freelancers
        const uniqueFlIds = Array.from(new Set(flatContracts.map(c => c.freelancer_id)))
        const freelancerCache: Record<number, { name: string; rate: number }> = {}

        await Promise.all(
          uniqueFlIds.map(async id => {
            try {
              const fl = await api.freelancers.get(id)
              freelancerCache[id] = { name: fl.name, rate: fl.hourly_rate }
            } catch {
              freelancerCache[id] = { name: `Freelancer #${id}`, rate: 0 }
            }
          })
        )

        const enriched: EnrichedContract[] = flatContracts.map(c => {
          const project = myProjs.find(p => p.id === c.project_id)
          const flInfo = freelancerCache[c.freelancer_id] || { name: 'Unknown', rate: 0 }
          return {
            ...c,
            projectName: project?.title || `Project #${c.project_id}`,
            freelancerName: flInfo.name,
            hourlyRate: flInfo.rate
          }
        })

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
  }, [session])

  const handleUpdateStatus = async (contractId: number, status: 'active' | 'completed' | 'cancelled') => {
    setActionLoading(contractId)
    setError(null)
    try {
      await api.contracts.updateStatus(contractId, status)
      setContracts(prev => 
        prev.map(c => c.id === contractId ? { ...c, status } : c)
      )
      setActionLoading(null)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The contract status wasn’t changed. Try again.')
      setActionLoading(null)
    }
  }

  const actions = (contract: EnrichedContract) => {
    const busy = actionLoading === contract.id
    if (contract.status === 'pending') {
      // A pending contract is an open offer or a freelancer's interest: accept it or decline it.
      return (
        <div className="flex gap-2 md:justify-end">
          <button type="button" disabled={busy} onClick={() => handleUpdateStatus(contract.id, 'active')} className="btn btn-sm btn-secondary">
            {busy ? 'Saving…' : 'Accept'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmCancel(contract)}
            className="btn btn-sm btn-ghost text-danger hover:bg-danger-tint hover:text-danger"
          >
            Decline
          </button>
        </div>
      )
    }
    if (contract.status === 'active') {
      return (
        <div className="flex gap-2 md:justify-end">
          <button type="button" disabled={busy} onClick={() => handleUpdateStatus(contract.id, 'completed')} className="btn btn-sm btn-secondary">
            {busy ? 'Saving…' : 'Mark complete'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmCancel(contract)}
            className="btn btn-sm btn-ghost text-danger hover:bg-danger-tint hover:text-danger"
          >
            Cancel
          </button>
        </div>
      )
    }
    return <span className="text-[13px] text-fg-3">Closed</span>
  }

  const created = (c: EnrichedContract) => (c.created_at ? new Date(c.created_at).toLocaleDateString() : '—')

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Engagements on your projects. Mark work complete when it's delivered, or cancel a contract that won't go ahead."
      />
      <PageBody className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card">
            <LoadingRows rows={4} label="Loading contracts" />
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden />}
            title="No contracts yet"
            description="Contracts are created when you hire someone from search results or the team builder."
            action={<Link href="/client/search" className="btn btn-sm btn-secondary">Find candidates</Link>}
          />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            {/* Wide screens: table */}
            <table className="data-table hidden md:table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Freelancer</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Rate</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(contract => (
                  <tr key={contract.id}>
                    <td className="font-semibold text-fg">{contract.projectName}</td>
                    <td className="text-fg">{contract.freelancerName}</td>
                    <td><StatusBadge status={contract.status} /></td>
                    <td className="text-right tabular-nums text-fg">{fmt.rate(contract.hourlyRate)}</td>
                    <td className="tabular-nums text-fg-2">{created(contract)}</td>
                    <td>{actions(contract)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Narrow screens: stacked list */}
            <ul className="divide-y divide-line md:hidden">
              {contracts.map(contract => (
                <li key={contract.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{contract.projectName}</p>
                      <p className="text-[13px] text-fg-2">{contract.freelancerName}</p>
                    </div>
                    <StatusBadge status={contract.status} />
                  </div>
                  <p className="flex gap-4 text-[13px] text-fg-2">
                    <span className="tabular-nums text-fg">{fmt.rate(contract.hourlyRate)}</span>
                    <span className="tabular-nums">Created {created(contract)}</span>
                  </p>
                  {actions(contract)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageBody>

      <Dialog
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        size="sm"
        title={confirmCancel?.status === 'pending' ? 'Decline this contract?' : 'Cancel this contract?'}
        description={confirmCancel ? `${confirmCancel.freelancerName} on ${confirmCancel.projectName}.` : undefined}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmCancel(null)}>Keep contract</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirmCancel) handleUpdateStatus(confirmCancel.id, 'cancelled')
                setConfirmCancel(null)
              }}
            >
              {confirmCancel?.status === 'pending' ? 'Decline' : 'Cancel contract'}
            </button>
          </>
        }
      >
        <p className="text-sm text-fg-2">The status changes to cancelled, and the contract can no longer be marked complete.</p>
      </Dialog>
    </>
  )
}
