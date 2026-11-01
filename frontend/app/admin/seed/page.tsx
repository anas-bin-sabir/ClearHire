'use client'

import { useState } from 'react'
import { api, SeedResponse } from '@/lib/api'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Dialog } from '@/components/ui/Dialog'
import { Notice, Spinner } from '@/components/ui/States'

export default function SeederPage() {
  const [freelancerCount, setFreelancerCount] = useState<number>(50)
  const [reset, setReset] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [response, setResponse] = useState<SeedResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSeed = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await api.seed({
        freelancer_count: freelancerCount,
        reset
      })
      setResponse(res)
      setLoading(false)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'Seeding failed. Check that the databases are reachable.')
      setLoading(false)
    }
  }

  const handleRunSeed = () => {
    // A reset deletes data, so it always asks first.
    if (reset) {
      setConfirmOpen(true)
      return
    }
    runSeed()
  }

  const results = response
    ? [
        { label: 'Freelancers', value: String(response.freelancers_created) },
        { label: 'Projects', value: String(response.projects_created) },
        { label: 'Contracts', value: String(response.contracts_created) },
        { label: 'Synced to Neo4j', value: response.neo4j_synced ? 'Yes' : 'No' },
      ]
    : []

  return (
    <>
      <PageHeader
        title="Data manager"
        description="Fill the databases with generated freelancers, projects and contracts for testing. Generated records are synthetic, not real people."
      />
      <div className="grid max-w-5xl grid-cols-1 gap-6 px-5 py-6 sm:px-8 sm:py-8 md:grid-cols-2">
        <Panel title="Seed settings">
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="seed-count" className="field-label">Freelancers to generate</label>
                <output htmlFor="seed-count" className="text-sm font-semibold tabular-nums text-fg">{freelancerCount}</output>
              </div>
              <input
                id="seed-count"
                type="range"
                min="10"
                max="200"
                step="10"
                value={freelancerCount}
                onChange={e => setFreelancerCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-xs tabular-nums text-fg-2" aria-hidden>
                <span>10</span>
                <span>200</span>
              </div>
            </div>

            <label className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 transition-colors duration-150 ${reset ? 'border-danger bg-danger-tint' : 'border-line'}`}>
              <input
                type="checkbox"
                checked={reset}
                onChange={e => setReset(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <span className="block text-sm font-semibold text-fg">Delete existing data first</span>
                <span className="mt-0.5 block text-[13px] text-fg-2">Removes all accounts, freelancers, projects and contracts from PostgreSQL, Neo4j and MongoDB before seeding.</span>
              </span>
            </label>

            <button
              type="button"
              onClick={handleRunSeed}
              disabled={loading}
              className={`btn w-full ${reset ? 'btn-danger' : 'btn-primary'}`}
            >
              {loading ? <><Spinner /> {reset ? 'Resetting and seeding' : 'Seeding'}</> : reset ? 'Reset and seed' : 'Seed databases'}
            </button>
          </div>
        </Panel>

        <Panel title="Result">
          <div aria-live="polite">
            {error && <Notice tone="danger">{error}</Notice>}
            {loading ? (
              <p role="status" className="flex items-center gap-2 text-sm text-fg-2"><Spinner /> Writing records. This can take a minute for large runs.</p>
            ) : response ? (
              <div className="space-y-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Seeding finished
                </p>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line">
                  {results.map(r => (
                    <div key={r.label} className="bg-panel px-4 py-3">
                      <dt className="text-xs text-fg-2">{r.label}</dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums text-fg">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[13px] text-fg-2">The dashboard, members list and fraud review now include the new records.</p>
              </div>
            ) : !error ? (
              <p className="text-sm text-fg-2">Nothing has run yet. Choose a size and seed.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Delete all data and reseed?"
        description="Every account, freelancer, project and contract in PostgreSQL, Neo4j and MongoDB is deleted. This can’t be undone."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Keep data</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirmOpen(false)
                runSeed()
              }}
            >
              Delete and reseed
            </button>
          </>
        }
      >
        <p className="text-sm text-fg-2">Then {freelancerCount} new freelancers are generated.</p>
      </Dialog>
    </>
  )
}
