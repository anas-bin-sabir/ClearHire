'use client'

import { useEffect, useState } from 'react'
import { api, ProjectRecord, ContractRecord, FreelancerRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Briefcase, ChevronDown, Search, UserPlus } from 'lucide-react'
import { Fragment } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, LoadingRows, Notice, Spinner } from '@/components/ui/States'
import { fmt, fraudLabel, fraudTone } from '@/lib/utils'

interface ProjectRow extends ProjectRecord {
  contracts: ContractRecord[]
  expanded?: boolean
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Member Search overlay context
  const [targetProject, setTargetProject] = useState<number | null>(null)
  const [freelancerSearch, setFreelancerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<FreelancerRecord[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<ContractRecord | null>(null)

  const loadProjects = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.projects.list(),
        api.contracts.all()
      ])

      const list = pRes.projects || []
      const flatContracts = cRes.contracts || []

      const enriched: ProjectRow[] = list.map(p => {
        return {
          ...p,
          contracts: flatContracts.filter(c => c.project_id === p.id),
          expanded: false
        }
      })

      setProjects(enriched)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load projects view:', err)
      setError('Projects couldn’t be loaded. Refresh the page to try again.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const toggleRow = (id: number) => {
    setProjects(prev => 
      prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p)
    )
  }

  const handleRemoveMember = async (contractId: number) => {
    setError(null)
    try {
      await api.contracts.updateStatus(contractId, 'cancelled')
      await loadProjects()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The contract wasn’t cancelled. Try again.')
    }
  }

  const handleOpenSearchModal = (pId: number) => {
    setTargetProject(pId)
    setFreelancerSearch('')
    setSearchResults([])
    setSearched(false)
  }

  const handleFreelancerSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!freelancerSearch.trim()) return
    setSearchLoading(true)
    setError(null)
    try {
      const res = await api.freelancers.list(freelancerSearch)
      setSearchResults(res.freelancers || [])
      setSearched(true)
      setSearchLoading(false)
    } catch (err) {
      console.error(err)
      setSearchLoading(false)
    }
  }

  const handleAddFreelancer = async (flId: number) => {
    if (!targetProject) return
    setError(null)
    try {
      await api.contracts.create({
        freelancer_id: flId,
        project_id: targetProject,
        status: 'active'
      })
      setTargetProject(null)
      await loadProjects()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The freelancer wasn’t added. Try again.')
    }
  }

  const target = projects.find(p => p.id === targetProject)

  return (
    <>
      <PageHeader
        title="Projects"
        description="All client projects and their teams. Add a freelancer to a team directly, or cancel an active contract."
      />
      <div className="space-y-4 px-5 py-6 sm:px-8 sm:py-8">
        {error && <Notice tone="danger">{error}</Notice>}

        {loading ? (
          <div className="rounded-panel border border-line-2 bg-panel p-5 shadow-card"><LoadingRows rows={5} label="Loading projects" /></div>
        ) : projects.length === 0 ? (
          <EmptyState icon={<Briefcase aria-hidden />} title="No projects yet" description="Projects appear here when clients post them, or after seeding the database." />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[960px]">
                <thead>
                  <tr>
                    <th scope="col" className="w-10"><span className="sr-only">Team</span></th>
                    <th scope="col">Project</th>
                    <th scope="col">Client</th>
                    <th scope="col" className="text-right">Budget</th>
                    <th scope="col">Required skills</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">Team</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(proj => (
                    <Fragment key={proj.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleRow(proj.id)}
                            aria-expanded={!!proj.expanded}
                            aria-label={`${proj.expanded ? 'Hide' : 'Show'} team for ${proj.title}`}
                            className="btn btn-icon btn-sm btn-ghost"
                          >
                            <ChevronDown className={`transition-transform duration-150 ${proj.expanded ? 'rotate-180' : ''}`} aria-hidden />
                          </button>
                        </td>
                        <td className="font-semibold text-fg">{proj.title}</td>
                        <td className="text-fg-2">{proj.client || '—'}</td>
                        <td className="text-right tabular-nums text-fg">{fmt.currency(proj.budget)}</td>
                        <td className="max-w-48 truncate text-fg-2">{proj.required_skills?.join(', ') || '—'}</td>
                        <td><StatusBadge status={proj.status} /></td>
                        <td className="text-right tabular-nums text-fg">
                          {proj.contracts.filter(c => c.status === 'active').length} / {proj.team_size}
                        </td>
                        <td className="text-right">
                          <button type="button" onClick={() => handleOpenSearchModal(proj.id)} className="btn btn-sm btn-secondary">
                            <UserPlus aria-hidden /> Add member
                          </button>
                        </td>
                      </tr>
                      {proj.expanded && (
                        <tr>
                          <td colSpan={8} className="bg-sunken">
                            <p className="text-[13px] font-semibold text-fg">Contracts on this project</p>
                            {proj.contracts && proj.contracts.length > 0 ? (
                              <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {proj.contracts.map(contract => (
                                  <li key={contract.id} className="flex items-center justify-between gap-3 rounded-field border border-line bg-panel px-3 py-2.5">
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-semibold text-fg">Freelancer #{contract.freelancer_id}</p>
                                      <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-2">
                                        <StatusBadge status={contract.status} />
                                        {contract.created_at && <span className="tabular-nums">since {new Date(contract.created_at).toLocaleDateString()}</span>}
                                      </p>
                                    </div>
                                    {contract.status === 'active' && (
                                      <button type="button" onClick={() => setConfirmRemove(contract)} className="btn btn-sm btn-ghost text-danger hover:bg-danger-tint hover:text-danger">
                                        Cancel
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-[13px] text-fg-2">No one is assigned yet.</p>
                            )}
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

      <Dialog
        open={targetProject !== null}
        onClose={() => setTargetProject(null)}
        title="Add a team member"
        description={target ? `Creates an active contract on ${target.title}.` : undefined}
      >
        <form onSubmit={handleFreelancerSearch} role="search" className="flex gap-2">
          <label htmlFor="add-member-search" className="sr-only">Search freelancers</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              id="add-member-search"
              type="search"
              placeholder="Search by name"
              value={freelancerSearch}
              onChange={e => setFreelancerSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button type="submit" disabled={searchLoading || !freelancerSearch.trim()} className="btn btn-secondary">
            {searchLoading ? <Spinner /> : 'Search'}
          </button>
        </form>
        <div className="mt-4" aria-live="polite">
          {searchResults.length > 0 ? (
            <ul className="divide-y divide-line rounded-field border border-line">
              {searchResults.map(fl => (
                <li key={fl.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={fl.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{fl.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-2">
                      <span className="tabular-nums">{fmt.rate(fl.hourly_rate)}</span>
                      <Badge tone={fraudTone(fl.fraud_score)}>{fraudLabel(fl.fraud_score)}</Badge>
                    </p>
                  </div>
                  <button type="button" onClick={() => handleAddFreelancer(fl.id)} className="btn btn-sm btn-primary">
                    Add
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <p className="text-sm text-fg-2">No freelancers match “{freelancerSearch}”.</p>
          ) : (
            <p className="text-sm text-fg-2">Search for a freelancer to add.</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        size="sm"
        title="Cancel this contract?"
        description={confirmRemove ? `Freelancer #${confirmRemove.freelancer_id} is removed from the team.` : undefined}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmRemove(null)}>Keep contract</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirmRemove) handleRemoveMember(confirmRemove.id)
                setConfirmRemove(null)
              }}
            >
              Cancel contract
            </button>
          </>
        }
      >
        <p className="text-sm text-fg-2">The contract status changes to cancelled.</p>
      </Dialog>
    </>
  )
}
