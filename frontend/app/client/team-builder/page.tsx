'use client'

import { useEffect, useState } from 'react'
import { api, TeamBuilderResponse, FreelancerRecord, ProjectRecord } from '@/lib/api'
import { FreelancerCard } from '@/components/ui/FreelancerCard'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { fmt } from '@/lib/utils'
import { 
  Sparkles, 
  Cpu, 
  HelpCircle, 
  Briefcase, 
  Plus, 
  Users, 
  Layers, 
  AlertTriangle,
  CheckCircle2,
  BookmarkCheck,
  Zap
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function TeamBuilderPage() {
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Client's projects list
  const [myProjects, setMyProjects] = useState<ProjectRecord[]>([])
  const [allSkills, setAllSkills] = useState<string[]>([])

  // Form Inputs
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [budget, setBudget] = useState<number>(5000)
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [teamSize, setTeamSize] = useState<number>(2)
  const [hoursPerMember, setHoursPerMember] = useState<number>(40)
  const [maxFraudScore, setMaxFraudScore] = useState<number>(0.6)
  const [deadlineDays, setDeadlineDays] = useState<number>(30)

  // Solver Result
  const [response, setResponse] = useState<TeamBuilderResponse | null>(null)

  // Skill search
  const [skillQuery, setSkillQuery] = useState('')

  useEffect(() => {
    // Load client projects
    api.projects.list()
      .then(res => setMyProjects(res.projects.filter(p => p.status === 'open')))
      .catch(err => console.error('Failed to load projects:', err))

    // Load distinct skills
    api.freelancers.skills()
      .then(res => setAllSkills(res.skills || []))
      .catch(err => console.error('Failed to load skills:', err))
  }, [])

  const handleProjectSelect = (pId: number) => {
    setSelectedProjectId(pId)
    const matched = myProjects.find(p => p.id === pId)
    if (matched) {
      setBudget(matched.budget)
      setRequiredSkills(matched.required_skills || [])
      setTeamSize(matched.team_size || 2)
      setDeadlineDays(matched.deadline_days || 30)
    }
  }

  const toggleSkill = (skill: string) => {
    setRequiredSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const handleBuildTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResponse(null)
    setSuccessMsg(null)

    const payload = {
      budget: Number(budget),
      required_skills: requiredSkills,
      team_size: Number(teamSize),
      hours_per_member: Number(hoursPerMember),
      max_fraud_score: Number(maxFraudScore),
      project_id: selectedProjectId || undefined,
      deadline_days: Number(deadlineDays)
    }

    try {
      const res = await api.teamBuilder.build(payload)
      setResponse(res)
      if (!res.success) {
        setError(res.message || 'No valid team configurations found under current constraint profiles.')
      }
      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Error occurred while solving CSP constraints.')
      setLoading(false)
    }
  }

  const handleHireTeam = async () => {
    if (!response || !response.team || response.team.length === 0) return
    if (!selectedProjectId) {
      setError('Please select or create a project first to assign and hire the team.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.contracts.batch({
        project_id: selectedProjectId,
        freelancer_ids: response.team.map(m => m.id),
        status: 'active'
      })
      setSuccessMsg('Successfully hired the entire team! Contracts have been created.')
      setResponse(null)
      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Batch hiring failed.')
      setLoading(false)
    }
  }

  const filteredSkills = allSkills.filter(s => 
    s.toLowerCase().includes(skillQuery.toLowerCase())
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="h-5.5 w-5.5 text-indigo-400" />
            AI Constraint Allocation (CSP Solver)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            allocates a complete developer team matching skills, budget limits, trust parameters, and hourly rates simultaneously.
          </p>
        </div>
        <div className="agent-badge">
          <span className="agent-dot" /> 🤖 CSP Agent Ready
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Constraints Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-electric" /> Input Constraints
            </h3>

            <form onSubmit={handleBuildTeam} className="space-y-4">
              <div>
                <label className="input-label">Associate Project (Recommended)</label>
                <select 
                  className="input cursor-pointer"
                  onChange={e => handleProjectSelect(Number(e.target.value))}
                  value={selectedProjectId || ''}
                >
                  <option value="">Create manual parameters...</option>
                  {myProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Allocated Project Budget ($)</label>
                <input 
                  type="number"
                  required
                  min="100"
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="input-label">Target Team Size: <strong className="text-white">{teamSize}</strong></label>
                <input 
                  type="range"
                  min="1"
                  max="10"
                  value={teamSize}
                  onChange={e => setTeamSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-electric"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>1 dev</span>
                  <span>5 devs</span>
                  <span>10 devs</span>
                </div>
              </div>

              <div>
                <label className="input-label">Engagement Hours per Member</label>
                <input 
                  type="number"
                  min="10"
                  max="200"
                  value={hoursPerMember}
                  onChange={e => setHoursPerMember(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="input-label">Trust Threshold (Max Fraud score): <strong className="text-white">{maxFraudScore}</strong></label>
                <input 
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={maxFraudScore}
                  onChange={e => setMaxFraudScore(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-electric"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>Oldest Accs (0.1)</span>
                  <span>Standard (0.6)</span>
                  <span>All (1.0)</span>
                </div>
              </div>

              <div>
                <label className="input-label">Deadline (Days)</label>
                <input 
                  type="number"
                  min="1"
                  value={deadlineDays}
                  onChange={e => setDeadlineDays(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="input-label">Team Skill Requirements</label>
                <input 
                  type="text"
                  placeholder="Filter skills list..."
                  value={skillQuery}
                  onChange={e => setSkillQuery(e.target.value)}
                  className="input mb-2 text-xs"
                />
                <div className="max-h-[100px] overflow-y-auto bg-slate-950/40 p-2 border border-white/5 rounded-lg flex flex-wrap gap-1">
                  {filteredSkills.map(skill => {
                    const active = requiredSkills.includes(skill)
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                          active 
                            ? 'bg-electric/20 text-white border border-electric/30' 
                            : 'bg-slate-900/80 text-slate-400 border border-white/5'
                        }`}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || requiredSkills.length === 0}
                className="w-full btn btn-md btn-primary flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <Zap className="h-4 w-4" />
                {loading ? 'Solving Constraints...' : 'Allocate Team'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Allocation Results */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 glass-card">
              <div className="h-8 w-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Solving backtrack logic graphs...</p>
            </div>
          ) : !response ? (
            <div className="glass-card p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center">
              <Users className="h-10 w-10 text-slate-700 mb-3" />
              Configure skills, budget limits, and trigger the solver to build your squad.
            </div>
          ) : response.success ? (
            <div className="space-y-6 animate-fade-in">
              {/* Solver stats header */}
              <div className="glass-card p-5 bg-indigo-500/3 border-indigo-500/10 flex flex-wrap justify-between items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Solution Confirmed</span>
                  <div className="text-lg font-bold text-white">Estimated cost: <strong className="text-emerald-400">{fmt.currency(response.total_cost)}</strong></div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="text-slate-500">Backtracks:</span> <strong className="text-white">{response.backtracks}</strong>
                  </div>
                  <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="text-slate-500">Nodes explored:</span> <strong className="text-white">{response.nodes_explored}</strong>
                  </div>
                </div>
              </div>

              {/* Team list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {response.team.map((member, idx) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                  >
                    <FreelancerCard 
                      freelancer={member}
                      role="client"
                      showHireAction={false}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleHireTeam}
                  className="btn btn-md btn-primary px-8 flex items-center gap-2 shadow-lg shadow-electric/25"
                >
                  <BookmarkCheck className="h-4 w-4" /> Hire Entire Team
                </button>
              </div>

              {/* AI Reasoning Explaining allocation */}
              {response.explanation && (
                <div className="pt-2">
                  <AIReasoningBox 
                    explanation={response.explanation}
                    title="CSP Agent Team Explanation"
                    defaultOpen={true}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-12 border-rose-500/10 bg-rose-500/2 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
              <h4 className="font-bold text-white text-base">Infeasible Constraints</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {response.message || 'The CSP solver backtracked completely without finding any valid freelancer matches that stay within the budget, skill profile, and fraud score limits.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
