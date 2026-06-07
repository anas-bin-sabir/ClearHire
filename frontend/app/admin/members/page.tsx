'use client'

import { useEffect, useState } from 'react'
import { api, FreelancerRecord, ContractRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { fmt } from '@/lib/utils'
import { 
  Users, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  DollarSign, 
  ShieldAlert, 
  Briefcase, 
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface MemberRow {
  id: number
  name: string
  skills: string[]
  hourly_rate: number
  monthly_ctc: number
  annual_ctc: number
  contract_count: number
  availability: boolean
  fraud_score: number
  portfolio_urls: string[]
  contracts: ContractRecord[]
  expanded?: boolean
}

type SortField = 'name' | 'hourly_rate' | 'monthly_ctc' | 'annual_ctc' | 'contract_count' | 'fraud_score'
type SortOrder = 'asc' | 'desc'

export default function MembersCTCPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const loadMembers = async (q?: string) => {
    try {
      const [flRes, cRes] = await Promise.all([
        api.freelancers.list(q),
        api.contracts.all()
      ])

      const freelancers = flRes.freelancers || []
      const allContracts = cRes.contracts || []

      const enriched: MemberRow[] = freelancers.map(fl => {
        const flContracts = allContracts.filter(c => c.freelancer_id === fl.id)
        return {
          id: fl.id,
          name: fl.name,
          skills: fl.skills || [],
          hourly_rate: fl.hourly_rate,
          monthly_ctc: fl.hourly_rate * 160,
          annual_ctc: fl.hourly_rate * 160 * 12,
          contract_count: flContracts.length,
          availability: fl.availability !== false,
          fraud_score: fl.fraud_score,
          portfolio_urls: fl.portfolio_urls || [],
          contracts: flContracts,
          expanded: false
        }
      })

      setMembers(enriched)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load members CTC list:', err)
      setError('Could not retrieve members data.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    loadMembers(searchQuery)
  }

  const toggleRow = (id: number) => {
    setMembers(prev => 
      prev.map(m => m.id === id ? { ...m, expanded: !m.expanded } : m)
    )
  }

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === 'asc'
    const newOrder: SortOrder = isAsc ? 'desc' : 'asc'
    setSortField(field)
    setSortOrder(newOrder)

    setMembers(prev => {
      const sorted = [...prev].sort((a, b) => {
        let valA = a[field]
        let valB = b[field]

        if (typeof valA === 'string' && typeof valB === 'string') {
          return newOrder === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA)
        }

        return newOrder === 'asc' 
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      })
      return sorted
    })
  }

  const exportCSV = () => {
    if (members.length === 0) return

    const headers = ['ID', 'Name', 'Skills', 'Hourly Rate ($/hr)', 'Monthly Est. CTC ($)', 'Annual Est. CTC ($)', 'Contracts count', 'Availability', 'Fraud Risk Score']
    const rows = members.map(m => [
      m.id,
      `"${m.name}"`,
      `"${m.skills.join(', ')}"`,
      m.hourly_rate,
      m.monthly_ctc,
      m.annual_ctc,
      m.contract_count,
      m.availability ? 'Available' : 'Busy',
      m.fraud_score
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `clearhire_members_ctc_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline ml-1" /> : <ChevronDown className="h-3.5 w-3.5 inline ml-1" />
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-rose" /> Members Compensation Registry (CTC)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            * Estimated financial projections are calculated based on hourly rate × 160hrs/month (1,920hrs/year).
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={members.length === 0}
          className="btn btn-md btn-ghost border-rose/25 hover:border-rose/40 text-rose flex items-center gap-2 cursor-pointer shadow-md shrink-0"
        >
          <Download className="h-4 w-4" /> Export CSV Sheet
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search members by name or unique ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-10 py-3"
          />
        </div>
        <button type="submit" className="btn btn-md btn-primary px-6 bg-rose hover:bg-rose-600 border-none text-white font-semibold cursor-pointer">
          Query
        </button>
      </form>

      {/* Members Spreadsheet Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Querying platform database records...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No member profiles found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  <th className="py-4 px-6 w-12" />
                  <th className="py-4 px-6" onClick={() => handleSort('name')}>Name <SortIcon field="name" /></th>
                  <th className="py-4 px-6">Skills</th>
                  <th className="py-4 px-6" onClick={() => handleSort('hourly_rate')}>Hourly <SortIcon field="hourly_rate" /></th>
                  <th className="py-4 px-6" onClick={() => handleSort('monthly_ctc')}>Monthly Est. <SortIcon field="monthly_ctc" /></th>
                  <th className="py-4 px-6" onClick={() => handleSort('annual_ctc')}>Annual Est. <SortIcon field="annual_ctc" /></th>
                  <th className="py-4 px-6" onClick={() => handleSort('contract_count')}>Contracts <SortIcon field="contract_count" /></th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6" onClick={() => handleSort('fraud_score')}>Risk <SortIcon field="fraud_score" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-xs text-slate-300">
                {members.map(member => {
                  const badgColor = member.fraud_score > 0.65 ? 'bg-rose-500/10 text-rose-400' : member.fraud_score > 0.35 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'

                  return (
                    <>
                      <tr 
                        key={member.id}
                        onClick={() => toggleRow(member.id)}
                        className="hover:bg-white/1 cursor-pointer transition-colors"
                      >
                        <td className="py-4 px-6">
                          {member.expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </td>
                        <td className="py-4 px-6 font-semibold text-white">{member.name}</td>
                        <td className="py-4 px-6 max-w-[150px] truncate">
                          {member.skills.slice(0, 2).join(', ')}{member.skills.length > 2 ? `, +${member.skills.length - 2}` : ''}
                        </td>
                        <td className="py-4 px-6 font-mono">${member.hourly_rate}/hr</td>
                        <td className="py-4 px-6 font-mono text-slate-300">{fmt.currency(member.monthly_ctc)}</td>
                        <td className="py-4 px-6 font-mono text-emerald-400 font-semibold">{fmt.currency(member.annual_ctc)}</td>
                        <td className="py-4 px-6 font-mono font-bold text-center">{member.contract_count}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            member.availability ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {member.availability ? 'Available' : 'Busy'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${badgColor}`}>
                            {Math.round(member.fraud_score * 100)}%
                          </span>
                        </td>
                      </tr>

                      <AnimatePresence>
                        {member.expanded && (
                          <tr key={`${member.id}-expanded`} className="bg-slate-950/20">
                            <td colSpan={9} className="py-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="p-6 border-b border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8"
                              >
                                {/* Left Side: Skills & Portfolio */}
                                <div className="space-y-4">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Profile Declared Skills</span>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {member.skills.map(s => <SkillBadge key={s} skill={s} />)}
                                    </div>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Declared Portfolios</span>
                                    {member.portfolio_urls && member.portfolio_urls.length > 0 ? (
                                      <ul className="space-y-1 mt-2 text-xs">
                                        {member.portfolio_urls.map((url, i) => (
                                          <li key={i}>
                                            <a 
                                              href={url} 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                                            >
                                              {url} <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-[10px] text-slate-500 italic mt-1">No external links declared.</p>
                                    )}
                                  </div>
                                </div>

                                {/* Right Side: Contracts History */}
                                <div className="space-y-3">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Assigned Contracts</span>
                                  {member.contracts && member.contracts.length > 0 ? (
                                    <div className="border border-white/5 rounded-xl bg-slate-950/40 divide-y divide-white/3 max-h-[160px] overflow-y-auto">
                                      {member.contracts.map(c => (
                                        <div key={c.id} className="p-3 flex justify-between items-center text-xs">
                                          <div className="space-y-0.5">
                                            <span className="text-slate-400 font-medium block">Project ID: #{c.project_id}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</span>
                                          </div>
                                          <StatusBadge status={c.status} />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500 italic">No assigned contracts.</p>
                                  )}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
