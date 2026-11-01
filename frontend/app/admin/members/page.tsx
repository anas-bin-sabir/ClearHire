'use client'

import { useEffect, useState } from 'react'
import { api, ContractRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { fmt, fraudLabel, fraudTone } from '@/lib/utils'
import { ChevronDown, ChevronUp, Download, ExternalLink, Search, Users } from 'lucide-react'
import { Fragment } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, LoadingRows, Notice } from '@/components/ui/States'

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
    } catch (err: unknown) {
      console.error('Failed to load members CTC list:', err)
      setError('Members couldn’t be loaded. Refresh the page to try again.')
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
        const valA = a[field]
        const valB = b[field]

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

  const sortHeader = (field: SortField, label: string, align: 'left' | 'right' = 'left') => {
    const active = sortField === field
    return (
      <th key={field} scope="col" aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className={align === 'right' ? 'text-right' : ''}>
        <button type="button" onClick={() => handleSort(field)} className={`inline-flex items-center gap-1 rounded-sm hover:text-fg ${active ? 'text-fg' : ''}`}>
          {label}
          {active ? (sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />) : null}
        </button>
      </th>
    )
  }

  return (
    <>
      <PageHeader
        title="Members"
        description="Every freelancer on the platform with estimated cost to company. Estimates assume 160 hours a month, 1,920 a year."
        actions={
          <button type="button" onClick={exportCSV} disabled={members.length === 0} className="btn btn-secondary">
            <Download aria-hidden /> Export CSV
          </button>
        }
      />
      <div className="space-y-4 px-5 py-6 sm:px-8 sm:py-8">
        <form onSubmit={handleSearchSubmit} role="search" className="flex max-w-xl gap-2">
          <label htmlFor="member-search" className="sr-only">Search members</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              id="member-search"
              type="search"
              placeholder="Search by name or skill"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        {error && <Notice tone="danger">{error}</Notice>}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card"><LoadingRows rows={5} label="Loading members" /></div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users aria-hidden />}
            title={searchQuery ? `No members match “${searchQuery}”` : 'No members yet'}
            description={searchQuery ? 'Try a different name or skill.' : 'Seed the database from the data manager to add freelancers.'}
          />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1040px] [&_td]:whitespace-nowrap">
                <thead>
                  <tr>
                    <th scope="col" className="w-10"><span className="sr-only">Details</span></th>
                    {sortHeader('name', 'Name')}
                    <th scope="col">Skills</th>
                    {sortHeader('hourly_rate', 'Hourly', 'right')}
                    {sortHeader('monthly_ctc', 'Monthly est.', 'right')}
                    {sortHeader('annual_ctc', 'Annual est.', 'right')}
                    {sortHeader('contract_count', 'Contracts', 'right')}
                    <th scope="col">Availability</th>
                    {sortHeader('fraud_score', 'Fraud risk')}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <Fragment key={member.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleRow(member.id)}
                            aria-expanded={!!member.expanded}
                            aria-label={`${member.expanded ? 'Hide' : 'Show'} details for ${member.name}`}
                            className="btn btn-icon btn-sm btn-ghost"
                          >
                            <ChevronDown className={`transition-transform duration-150 ${member.expanded ? 'rotate-180' : ''}`} aria-hidden />
                          </button>
                        </td>
                        <td className="font-semibold text-fg">{member.name}</td>
                        <td className="max-w-44 truncate text-fg-2">
                          {member.skills.slice(0, 2).join(', ')}{member.skills.length > 2 ? `, +${member.skills.length - 2}` : ''}
                        </td>
                        <td className="text-right tabular-nums text-fg">{fmt.rate(member.hourly_rate)}</td>
                        <td className="text-right tabular-nums text-fg-2">{fmt.currency(member.monthly_ctc)}</td>
                        <td className="text-right font-semibold tabular-nums text-fg">{fmt.currency(member.annual_ctc)}</td>
                        <td className="text-right tabular-nums text-fg">{member.contract_count}</td>
                        <td>{member.availability ? <Badge tone="ok">Available</Badge> : <Badge>Busy</Badge>}</td>
                        <td>
                          <Badge tone={fraudTone(member.fraud_score)}>
                            <span className="tabular-nums">{Math.round(member.fraud_score * 100)}%</span> {fraudLabel(member.fraud_score).toLowerCase()}
                          </Badge>
                        </td>
                      </tr>
                      {member.expanded && (
                        <tr>
                          <td colSpan={9} className="bg-sunken">
                            <div className="grid grid-cols-1 gap-6 py-2 md:grid-cols-3">
                              <div>
                                <p className="text-[13px] font-semibold text-fg">Skills</p>
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                  {member.skills.map(s => <li key={s}><SkillBadge skill={s} /></li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-fg">Portfolio</p>
                                {member.portfolio_urls.length > 0 ? (
                                  <ul className="mt-2 space-y-1">
                                    {member.portfolio_urls.map((url, i) => (
                                      <li key={i}>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[13px] font-medium text-primary-ink hover:underline">
                                          <span className="truncate">{url}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                          <span className="sr-only">(opens in a new tab)</span>
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-[13px] text-fg-2">No links.</p>
                                )}
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-fg">Contracts</p>
                                {member.contracts.length > 0 ? (
                                  <ul className="mt-2 divide-y divide-line">
                                    {member.contracts.map(c => (
                                      <li key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                                        <span className="text-fg">
                                          Project #{c.project_id}
                                          <span className="ml-2 tabular-nums text-fg-2">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</span>
                                        </span>
                                        <StatusBadge status={c.status} />
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-[13px] text-fg-2">None.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
