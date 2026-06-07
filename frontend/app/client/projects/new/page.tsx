'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Briefcase, 
  Search, 
  ShieldCheck,
  Code
} from 'lucide-react'

export default function NewProjectPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(false)

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [teamSize, setTeamSize] = useState(1)
  const [budget, setBudget] = useState<number>(1000)
  const [deadlineDays, setDeadlineDays] = useState<number>(30)

  // Skill choices from DB
  const [availableSkills, setAvailableSkills] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')

  useEffect(() => {
    api.freelancers.skills()
      .then(res => setAvailableSkills(res.skills || []))
      .catch(err => console.error('Failed to load skills:', err))
  }, [])

  const nextStep = () => {
    if (step < 3) {
      setDirection(1)
      setStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setDirection(-1)
      setStep(prev => prev - 1)
    }
  }

  const toggleSkill = (skill: string) => {
    setRequiredSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const clientName = session?.user?.name || 'Sara Ahmed'
      const result = await api.projects.create({
        title,
        description,
        client: clientName,
        required_skills: requiredSkills,
        budget: Number(budget),
        deadline_days: Number(deadlineDays),
        team_size: Number(teamSize)
      })
      router.push(`/client/search?projectId=${result.project.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
      setLoading(false)
    }
  }

  const filteredSkills = availableSkills.filter(s => 
    s.toLowerCase().includes(skillSearch.toLowerCase())
  )

  const stepsInfo = [
    { num: 1, label: 'Scope' },
    { num: 2, label: 'Skills' },
    { num: 3, label: 'Budget' }
  ]

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      {/* Steps indicator */}
      <div className="flex justify-between items-center px-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-electric" /> Post a Job
        </h2>
        
        <div className="flex items-center gap-2">
          {stepsInfo.map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all duration-300 ${
                step >= s.num
                  ? 'bg-electric text-white border-electric shadow-lg shadow-electric/25'
                  : 'bg-slate-900 text-slate-500 border-white/5'
              }`}>
                {s.num}
              </span>
              {idx < stepsInfo.length - 1 && (
                <div className={`w-8 h-[1px] transition-all duration-300 ${step > s.num ? 'bg-electric' : 'bg-white/5'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Glass Form Container */}
      <div className="glass-card p-8 min-h-[380px] flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-electric/2 rounded-full blur-2xl pointer-events-none" />

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div 
              key={step}
              initial={{ opacity: 0, x: direction > 0 ? 32 : -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -32 : 32 }}
              transition={{ duration: 0.22 }}
              className="space-y-5 flex-1"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Define project scope</h3>
                    <p className="text-xs text-slate-400">Introduce your project clearly to match the best specialists.</p>
                  </div>
                  <div>
                    <label className="input-label">Project Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Develop high-throughput FastAPI microservice"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Detailed Description</label>
                    <textarea 
                      required
                      rows={5}
                      placeholder="Provide full description of tasks, technical needs, deliverables..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="input resize-none"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Specify required skills</h3>
                    <p className="text-xs text-slate-400">Select skills needed for the team members to complete this job.</p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Search skills (e.g. React, Python...)"
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      className="input pl-10"
                    />
                  </div>

                  {/* Skills lists */}
                  <div className="max-h-[160px] overflow-y-auto border border-white/5 rounded-xl bg-slate-950/30 p-3 flex flex-wrap gap-1.5">
                    {filteredSkills.map(skill => {
                      const selected = requiredSkills.includes(skill)
                      return (
                        <button
                          type="button"
                          key={skill}
                          onClick={() => toggleSkill(skill)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                            selected
                              ? 'bg-electric text-white border-electric shadow-md'
                              : 'bg-slate-900 text-slate-300 border-white/5 hover:border-white/10'
                          }`}
                        >
                          {skill}
                          {selected && <Check className="h-3 w-3 ml-1.5" />}
                        </button>
                      )
                    })}
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
                      <span>1 member</span>
                      <span>5 members</span>
                      <span>10 members</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Budget and Timeline</h3>
                    <p className="text-xs text-slate-400">Set realistic budgets and timelines to ensure successful agent matches.</p>
                  </div>
                  <div>
                    <label className="input-label">Total Allocated Budget ($)</label>
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
                    <label className="input-label">Deadline (Days)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={deadlineDays}
                      onChange={e => setDeadlineDays(Number(e.target.value))}
                      className="input font-mono"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex justify-between border-t border-white/3 pt-6 mt-8">
            <button
              type="button"
              disabled={step === 1 || loading}
              onClick={prevStep}
              className="btn btn-md btn-ghost disabled:opacity-30 flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={step === 1 && !title.trim()}
                onClick={nextStep}
                className="btn btn-md btn-primary flex items-center gap-1.5"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="btn btn-md btn-primary shadow-lg shadow-electric/25 flex items-center gap-2"
              >
                {loading ? 'Creating project...' : 'Submit & Find Matches'}
                {!loading && <Check className="h-4 w-4" />}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
