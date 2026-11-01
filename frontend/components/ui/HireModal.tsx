'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { api, ProjectRecord } from '@/lib/api'
import { Dialog } from './Dialog'
import { Notice, Spinner } from './States'

interface Props {
  freelancerId: number
  freelancerName?: string
  onSuccess: () => void
  onClose: () => void
  /** Defaults to true so existing call sites that mount/unmount the modal keep working. */
  open?: boolean
}

export function HireModal({ freelancerId, freelancerName, onSuccess, onClose, open = true }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null)
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    api.projects.list()
      .then(r => {
        if (active) setProjects(r.projects.filter(p => p.status === 'open'))
      })
      .catch(err => {
        console.error('Failed to load projects:', err)
        if (active) setError('Your projects didn’t load. Close this dialog and try again.')
      })
    return () => {
      active = false
    }
  }, [open])

  const hire = async () => {
    if (!selectedProject) return
    setLoading(true)
    setError(null)
    try {
      await api.contracts.create({
        freelancer_id: freelancerId,
        project_id: selectedProject,
        status: 'active',
      })
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The contract wasn’t created. Try again.')
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={freelancerName ? `Hire ${freelancerName}` : 'Hire freelancer'}
      description="Choose the open project this contract belongs to. The contract starts as active."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={hire} disabled={!selectedProject || loading}>
            {loading && <Spinner />}
            {loading ? 'Hiring…' : 'Hire'}
          </button>
        </>
      }
    >
      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      {projects === null && !error ? (
        <p role="status" className="flex items-center gap-2 text-sm text-fg-2">
          <Spinner /> Loading your open projects
        </p>
      ) : projects && projects.length === 0 ? (
        <div className="rounded-field border border-dashed border-line-strong px-4 py-6 text-center">
          <p className="text-sm text-fg-2">You have no open projects. Post one first, then hire into it.</p>
          <Link href="/client/projects/new" className="btn btn-sm btn-secondary mt-3">
            <Plus aria-hidden /> Post a project
          </Link>
        </div>
      ) : projects ? (
        <div>
          <label htmlFor="hire-project" className="field-label">Project</label>
          <select
            id="hire-project"
            className="input"
            onChange={e => setSelectedProject(Number(e.target.value))}
            defaultValue=""
          >
            <option value="" disabled>Choose a project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.title || `Project #${p.id}`} (budget ${p.budget.toLocaleString('en-US')})
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </Dialog>
  )
}
