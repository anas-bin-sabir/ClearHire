'use client'

import { useEffect, useState } from 'react'
import { api, ProjectRecord, ContractRecord, FreelancerRecord } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { 
  Briefcase, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  AlertCircle,
  X,
  PlusCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to remove team member.')
    }
  }

  const handleOpenSearchModal = (pId: number) => {
    setTargetProject(pId)
    setFreelancerSearch('')
    setSearchResults([])
  }

  const handleFreelancerSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!freelancerSearch.trim()) return
    setSearchLoading(true)
    setError(null)
    try {
      const res = await api.freelancers.list(freelancerSearch)
      setSearchResults(res.freelancers || [])
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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to add freelancer to team.')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-rose border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading projects catalog...</p>
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
            <Briefcase className="h-5.5 w-5.5 text-rose" /> Projects Registry
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage project members, cancel engagements, and allocate specialists to client projects manually.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Projects spreadsheet */}
      <div className="glass-card overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No projects registered on the platform.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-12" />
                  <th className="py-4 px-6">Project Title</th>
                  <th className="py-4 px-6">Client</th>
                  <th className="py-4 px-6">Budget</th>
                  <th className="py-4 px-6">Skills Required</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Team Size</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-xs text-slate-300">
                {projects.map(proj => (
                  <>
                    <tr 
                      key={proj.id}
                      onClick={() => toggleRow(proj.id)}
                      className="hover:bg-white/1 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6">
                        {proj.expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </td>
                      <td className="py-4 px-6 font-semibold text-white">{proj.title}</td>
                      <td className="py-4 px-6">{proj.client || 'Sara Ahmed'}</td>
                      <td className="py-4 px-6 font-mono">${proj.budget.toLocaleString()}</td>
                      <td className="py-4 px-6 truncate max-w-[150px]">{proj.required_skills?.join(', ') || 'N/A'}</td>
                      <td className="py-4 px-6">
                        <StatusBadge status={proj.status} />
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-center">
                        {proj.contracts.filter(c => c.status === 'active').length} / {proj.team_size}
                      </td>
                      <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenSearchModal(proj.id)}
                          className="btn btn-sm btn-ghost border-rose/15 text-rose flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Member
                        </button>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {proj.expanded && (
                        <tr key={`${proj.id}-expanded`} className="bg-slate-950/20">
                          <td colSpan={8} className="py-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              className="p-6 border-b border-white/5"
                            >
                              <div className="space-y-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Current Assigned Team Members</span>
                                {proj.contracts && proj.contracts.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {proj.contracts.map(contract => (
                                      <div 
                                        key={contract.id}
                                        className="p-3.5 rounded-xl border border-white/3 bg-slate-900/60 flex justify-between items-center text-xs"
                                      >
                                        <div className="space-y-0.5">
                                          <span className="font-semibold text-white">Freelancer ID: #{contract.freelancer_id}</span>
                                          <div className="flex gap-2 items-center text-[10px] text-slate-500 mt-1">
                                            <StatusBadge status={contract.status} />
                                            <span>since {contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'N/A'}</span>
                                          </div>
                                        </div>

                                        {contract.status === 'active' && (
                                          <button
                                            onClick={() => handleRemoveMember(contract.id)}
                                            className="btn btn-sm btn-danger p-2 rounded-lg cursor-pointer"
                                            title="Cancel contract"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 italic py-2">No team members assigned.</p>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member Addition Search Overlay Modal */}
      <AnimatePresence>
        {targetProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              onClick={() => setTargetProject(null)}
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-lg bg-slate-900 border border-white/5 shadow-2xl rounded-2xl overflow-hidden relative z-10 p-6 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-rose" /> Add Team Member
                </h3>
                <button 
                  onClick={() => setTargetProject(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleFreelancerSearch} className="flex gap-2 mb-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    required
                    placeholder="Search by freelancer name..."
                    value={freelancerSearch}
                    onChange={e => setFreelancerSearch(e.target.value)}
                    className="input pl-10"
                  />
                </div>
                <button type="submit" className="btn btn-md btn-primary bg-rose hover:bg-rose-600 border-none text-white font-semibold cursor-pointer">
                  Find
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-3 bg-slate-950/20 p-2.5 border border-white/5 rounded-xl min-h-[200px]">
                {searchLoading ? (
                  <div className="flex justify-center items-center py-12 text-xs font-mono text-slate-500">
                    Querying talent pool...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs py-12">
                    Enter search query to locate freelancers.
                  </div>
                ) : (
                  searchResults.map(fl => (
                    <div 
                      key={fl.id}
                      className="p-3.5 rounded-xl border border-white/3 bg-slate-900/40 flex justify-between items-center text-xs"
                    >
                      <div>
                        <h5 className="font-bold text-white text-sm">{fl.name}</h5>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">Rate: ${fl.hourly_rate}/hr · Risk: {Math.round(fl.fraud_score * 100)}%</p>
                      </div>

                      <button
                        onClick={() => handleAddFreelancer(fl.id)}
                        className="btn btn-sm btn-ghost hover:bg-rose/10 hover:text-rose border-rose/10 flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
