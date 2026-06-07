'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ContractRecord, ProjectRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmt } from '@/lib/utils'
import { 
  FileText, 
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

interface EnrichedContract extends ContractRecord {
  projectTitle: string
  budget: number
}

export default function FreelancerContractsPage() {
  const { data: session } = useSession()
  const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

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
            } catch (err) {
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
  }, [flId])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-mint border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Retrieving active agreements...</p>
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
            <FileText className="h-5.5 w-5.5 text-mint" /> Contracts Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">Read-only history of your project contracts and applications status.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {contracts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            You don't have any contract records. ViewMatches to find projects fitting your skills.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-6">Project Title</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Your Rate</th>
                  <th className="py-4 px-6">Project Budget</th>
                  <th className="py-4 px-6">Assigned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-xs text-slate-300">
                {contracts.map(contract => (
                  <tr key={contract.id} className="hover:bg-white/1">
                    <td className="py-4 px-6 font-semibold text-white">{contract.projectTitle}</td>
                    <td className="py-4 px-6">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-300">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-mint" /> 
                        {fmt.rate(hourlyRate)}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400">
                      ${contract.budget.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'N/A'}
                      </span>
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
