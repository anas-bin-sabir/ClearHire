'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, ProjectRecord } from '@/lib/api'
import { X, Briefcase, Plus, CheckCircle } from 'lucide-react'

interface Props {
  freelancerId: number
  onSuccess: () => void
  onClose: () => void
}

export function HireModal({ freelancerId, onSuccess, onClose }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.projects.list()
      .then(r => {
        if (active) {
          // Filter projects that are currently open
          setProjects(r.projects.filter(p => p.status === 'open'))
        }
      })
      .catch(err => {
        console.error('Failed to load projects:', err)
        if (active) setError('Could not load projects. Please try again.')
      })
    return () => {
      active = false
    }
  }, [])

  const hire = async () => {
    if (!selectedProject) return
    setLoading(true)
    setError(null)
    try {
      await api.contracts.create({ 
        freelancer_id: freelancerId, 
        project_id: selectedProject, 
        status: 'active' 
      })
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to hire freelancer.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        onClick={onClose}
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
      />

      {/* Modal */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-slate-900 border border-white/5 shadow-2xl rounded-2xl overflow-hidden relative z-10 p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-electric" /> Hire Freelancer
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="input-label">Select Project</label>
          {projects.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/5 rounded-xl bg-slate-950/20">
              <p className="text-slate-400 text-xs mb-3">You don't have any open projects</p>
              <a 
                href="/client/projects/new" 
                className="btn btn-sm btn-ghost inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Create a Job
              </a>
            </div>
          ) : (
            <select 
              className="input cursor-pointer" 
              onChange={e => setSelectedProject(Number(e.target.value))}
              defaultValue=""
            >
              <option value="" disabled>Choose a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title || `Project #${p.id}`} (Budget: ${p.budget})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button 
            className="btn btn-md btn-ghost" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="btn btn-md btn-primary flex items-center gap-2" 
            onClick={hire} 
            disabled={!selectedProject || loading}
          >
            <CheckCircle className="h-4 w-4" />
            {loading ? 'Hiring...' : 'Confirm Hire'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
