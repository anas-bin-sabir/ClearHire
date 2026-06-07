'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ContractRecord, ProjectRecord, FreelancerRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar,
  DollarSign
} from 'lucide-react'
import { motion } from 'framer-motion'

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
            } catch (err) {
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
      } catch (err: any) {
        console.error(err)
        if (active) {
          setError('Failed to retrieve contracts.')
          setLoading(false)
        }
      }
    }

    loadContracts()
    return () => {
      active = false
    }
  }, [session])

  const handleUpdateStatus = async (contractId: number, status: 'completed' | 'cancelled') => {
    setActionLoading(contractId)
    setError(null)
    try {
      await api.contracts.updateStatus(contractId, status)
      setContracts(prev => 
        prev.map(c => c.id === contractId ? { ...c, status } : c)
      )
      setActionLoading(null)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to update contract status.')
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-electric border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Retrieving active agreements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="h-5.5 w-5.5 text-indigo-400" /> Contracts Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage project engagements, track status milestones, and cancel or complete developer services.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Contracts Table */}
      <div className="glass-card overflow-hidden">
        {contracts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            You don't have any active contracts. Initiate hires through the search matchmaking view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Project Name</th>
                  <th className="py-4 px-6">Freelancer</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Compensation</th>
                  <th className="py-4 px-6">Created</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-sm text-slate-300">
                {contracts.map(contract => (
                  <tr key={contract.id} className="hover:bg-white/1">
                    <td className="py-4.5 px-6 font-semibold text-white">{contract.projectName}</td>
                    <td className="py-4.5 px-6">{contract.freelancerName}</td>
                    <td className="py-4.5 px-6">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="py-4.5 px-6 font-mono text-xs">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> 
                        {fmt.rate(contract.hourlyRate)}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 font-mono text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      {contract.status === 'active' || contract.status === 'pending' ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={actionLoading === contract.id}
                            onClick={() => handleUpdateStatus(contract.id, 'completed')}
                            className="btn btn-sm btn-ghost hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 text-slate-400 flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {actionLoading === contract.id ? '...' : 'Complete'}
                          </button>
                          <button
                            disabled={actionLoading === contract.id}
                            onClick={() => handleUpdateStatus(contract.id, 'cancelled')}
                            className="btn btn-sm btn-danger flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {actionLoading === contract.id ? '...' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No Actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
