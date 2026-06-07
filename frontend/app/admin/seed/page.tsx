'use client'

import { useState } from 'react'
import { api, SeedResponse } from '@/lib/api'
import { 
  Database, 
  Trash2, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Users,
  Briefcase,
  FileText,
  Network
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function SeederPage() {
  const [freelancerCount, setFreelancerCount] = useState<number>(50)
  const [reset, setReset] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  
  const [response, setResponse] = useState<SeedResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunSeed = async () => {
    // Confirmation check if reset is true
    if (reset) {
      const confirmReset = window.confirm(
        "WARNING: Resetting database will delete all existing user accounts, freelancer declarations, projects, and active contracts from PostgreSQL, Neo4j, and MongoDB databases! Are you sure you want to proceed?"
      )
      if (!confirmReset) return
    }

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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Database seeding failed.')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="h-5.5 w-5.5 text-rose" /> Cluster Seeder Control
          </h2>
          <p className="text-xs text-slate-400 mt-1">Populate datastores with mock data clusters. Useful for sandbox evaluations and testing matching limits.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertTriangle className="h-5.5 w-5.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Control panel & seed results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Controls */}
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">Seeding Parameters</h3>

          <div className="space-y-5">
            <div>
              <label className="input-label">Freelancer Generation Size: <strong className="text-white font-mono">{freelancerCount}</strong></label>
              <input 
                type="range"
                min="10"
                max="200"
                step="10"
                value={freelancerCount}
                onChange={e => setFreelancerCount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                <span>10 profiles</span>
                <span>100 profiles</span>
                <span>200 profiles</span>
              </div>
            </div>

            {/* Reset toggle */}
            <div className={`p-4 rounded-xl border flex justify-between items-center transition-all ${
              reset 
                ? 'bg-rose-500/5 border-rose-500/20 shadow-md shadow-rose-500/3' 
                : 'bg-slate-950/20 border-white/5'
            }`}>
              <div className="space-y-0.5 max-w-[200px]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4 text-rose" /> Purge databases
                </span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Deletes all freelancers, contracts, and projects before seeding.
                </p>
              </div>

              <input 
                type="checkbox"
                checked={reset}
                onChange={e => setReset(e.target.checked)}
                className="rounded bg-slate-900 border-white/5 text-rose focus:ring-0 cursor-pointer h-4.5 w-4.5"
              />
            </div>

            <button
              onClick={handleRunSeed}
              disabled={loading}
              className={`w-full btn btn-md flex items-center justify-center gap-2 cursor-pointer ${
                reset ? 'btn-danger' : 'btn-primary bg-rose hover:bg-rose-600 border-none'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Purging & Seeding...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Run Seed Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Results Card */}
        <div className="glass-card p-6 flex flex-col justify-between min-h-[300px]">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">Seeding Response</h3>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-slate-500">Injecting tuples to PostgreSQL...</span>
            </div>
          ) : response ? (
            <div className="flex-1 flex flex-col justify-between pt-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-4">
                  <CheckCircle className="h-4.5 w-4.5" /> Database populated successfully
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <Users className="h-5 w-5 text-indigo-400" />
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Freelancers</span>
                      <p className="font-bold text-white mt-0.5">{response.freelancers_created}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-emerald-400" />
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Projects</span>
                      <p className="font-bold text-white mt-0.5">{response.projects_created}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-amber-400" />
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Contracts</span>
                      <p className="font-bold text-white mt-0.5">{response.contracts_created}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                    <Network className="h-5 w-5 text-rose" />
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Neo4j Sync</span>
                      <p className="font-bold text-white mt-0.5 uppercase">{response.neo4j_synced ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 leading-normal border-t border-white/3 pt-4 mt-6">
                Check details under dashboard stats and review queue metrics.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-12">
              Seeder is idle. Choose target settings and click Run.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
