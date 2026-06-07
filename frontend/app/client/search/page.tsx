'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, FreelancerRecord, ProjectRecord } from '@/lib/api'
import { FreelancerCard } from '@/components/ui/FreelancerCard'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { Search, Filter, Sparkles, AlertCircle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectRecord | null>(null)
  
  // Results
  const [results, setResults] = useState<any[]>([])
  const [explanation, setExplanation] = useState<string>('')
  
  // Search Form State
  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [minRate, setMinRate] = useState<number>(0)
  const [maxRate, setMaxRate] = useState<number>(300)
  const [minRating, setMinRating] = useState<number>(0)
  const [availableOnly, setAvailableOnly] = useState(true)
  const [maxFraud, setMaxFraud] = useState<number>(0.6)
  const [budget, setBudget] = useState<number>(10000)
  const [teamSize, setTeamSize] = useState<number>(1)

  // Skill options
  const [allSkills, setAllSkills] = useState<string[]>([])

  useEffect(() => {
    // Load skills
    api.freelancers.skills()
      .then(res => setAllSkills(res.skills || []))
      .catch(err => console.error('Failed to load skills:', err))

    // Handle project context if passed
    if (projectIdParam) {
      const pId = Number(projectIdParam)
      setLoading(true)
      
      Promise.all([
        api.projects.get(pId),
        api.search.precomputed(pId)
      ])
      .then(([proj, precomputed]) => {
        setProject(proj)
        
        // Map precomputed results to UI state
        if (precomputed.precomputed && precomputed.results) {
          setResults(precomputed.results)
        } else {
          // If no precomputed, pre-populate form and trigger search
          setQuery(proj.description || '')
          setSkills(proj.required_skills || [])
          setBudget(proj.budget || 5000)
          setTeamSize(proj.team_size || 1)
          
          // Execute immediate search
          executeSearch({
            query: proj.description || '',
            skills: proj.required_skills || [],
            minRate: 0,
            maxRate: 300,
            minRating: 0,
            availableOnly: true,
            maxFraud: 0.6,
            budget: proj.budget || 5000,
            team_size: proj.team_size || 1
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load project search context:', err)
        setError('Failed to load project matching context.')
        setLoading(false)
      })
    }
  }, [projectIdParam])

  const executeSearch = async (body: any) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.search.run(body)
      setResults(res.freelancers || [])
      setExplanation(res.explanation || '')
      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Search execution failed. Please try again.')
      setLoading(false)
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      query,
      skills,
      minRate,
      maxRate,
      minRating,
      availableOnly,
      maxFraud,
      budget,
      team_size: teamSize
    }
    executeSearch(payload)
  }

  const toggleFormSkill = (skill: string) => {
    setSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" /> 
            {project ? `Matches for ${project.title}` : 'AI-Driven Skill Matchmaking'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {project 
              ? 'Displaying precalculated A* similarity rankings generated automatically by the ClearHire Matching Agent.'
              : 'Search the talent pool using natural language, skill requirements, and trust criteria.'}
          </p>
        </div>
        {project && (
          <AgentStatusBadge 
            entityType="project"
            entityId={project.id}
            pipeline="matching"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Search Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 space-y-6 sticky top-8">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Filter className="h-4.5 w-4.5 text-electric" /> Search Parameters
            </h3>

            <form onSubmit={handleManualSearch} className="space-y-4">
              <div>
                <label className="input-label">Natural Language Prompt</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="e.g. Python microservice expert with Docker"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Filter Skills</label>
                <div className="max-h-[120px] overflow-y-auto bg-slate-950/40 p-2.5 rounded-xl border border-white/5 flex flex-wrap gap-1">
                  {allSkills.map(skill => {
                    const active = skills.includes(skill)
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleFormSkill(skill)}
                        className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors ${
                          active 
                            ? 'bg-electric/15 text-white border-electric' 
                            : 'bg-slate-900/60 text-slate-400 border-white/5'
                        }`}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Min Rate ($/hr)</label>
                  <input 
                    type="number"
                    min="0"
                    value={minRate}
                    onChange={e => setMinRate(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="input-label">Max Rate ($/hr)</label>
                  <input 
                    type="number"
                    min="0"
                    value={maxRate}
                    onChange={e => setMaxRate(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Min Rating</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={minRating}
                    onChange={e => setMinRating(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="input-label">Max Fraud Threshold</label>
                  <input 
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={maxFraud}
                    onChange={e => setMaxFraud(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="availCheck"
                  checked={availableOnly}
                  onChange={e => setAvailableOnly(e.target.checked)}
                  className="rounded bg-slate-900 border-white/5 text-electric focus:ring-0 cursor-pointer h-4 w-4"
                />
                <label htmlFor="availCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">Available Candidates Only</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-md btn-primary flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Matching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Run Matchmaker
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Search Results */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 glass-card">
              <div className="h-8 w-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Evaluating matches via A* Engine...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-500 text-sm">
              No matching freelancers found. Try relaxing the search parameters.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Matches Found ({results.length})
                </h3>
                {project && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Project scope: {project.required_skills?.join(', ')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((fl, idx) => (
                  <motion.div
                    key={fl.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                  >
                    <FreelancerCard 
                      freelancer={fl}
                      role="client"
                      showHireAction={true}
                      onHireSuccess={() => {
                        // Reload precomputed or search results on success
                        if (projectIdParam) {
                          api.search.precomputed(Number(projectIdParam))
                            .then(r => setResults(r.results || []))
                        } else {
                          const payload = {
                            query,
                            skills,
                            minRate,
                            maxRate,
                            minRating,
                            availableOnly,
                            maxFraud,
                            budget,
                            team_size: teamSize
                          }
                          executeSearch(payload)
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              {explanation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="pt-4"
                >
                  <AIReasoningBox 
                    explanation={explanation}
                    title="Matchmaker Agent Explanations"
                    defaultOpen={true}
                  />
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
