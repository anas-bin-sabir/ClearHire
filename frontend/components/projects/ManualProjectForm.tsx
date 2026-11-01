'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { Check, Plus, Search, X } from 'lucide-react'
import { Notice, Spinner } from '@/components/ui/States'

/** The original three-step form, kept as the manual alternative to brief extraction. */
export function ManualProjectForm() {
  const router = useRouter()
  const { data: session } = useSession()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const [customSkillInput, setCustomSkillInput] = useState('')

  useEffect(() => {
    api.freelancers.skills()
      .then(res => setAvailableSkills(res.skills || []))
      .catch(err => console.error('Failed to load skills:', err))
  }, [])

  const nextStep = () => {
    if (step < 3) {
      setStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(prev => prev - 1)
    }
  }

  const toggleSkill = (skill: string) => {
    setRequiredSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const addCustomSkill = () => {
    const t = customSkillInput.trim()
    if (t && !requiredSkills.includes(t)) setRequiredSkills(prev => [...prev, t])
    setCustomSkillInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      return
    }
    setLoading(true)
    setError(null)
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
      setError('The project wasn’t created. Check the fields and try again.')
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
    <form onSubmit={handleSubmit} className="rounded-panel border border-line-2 bg-panel shadow-card">
      {/* Steps: a real sequence, so numbered. */}
      <ol className="flex border-b border-line" aria-label="Form progress">
        {stepsInfo.map(s => {
          const done = step > s.num
          const current = step === s.num
          return (
            <li
              key={s.num}
              aria-current={current ? 'step' : undefined}
              className={`flex flex-1 items-center gap-2 px-4 py-3 text-[13px] font-semibold sm:px-6 ${
                current ? 'text-fg shadow-[inset_0_-2px_0_var(--primary)]' : done ? 'text-fg' : 'text-fg-2'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabular-nums ${
                  done ? 'bg-teal-tint text-teal-ink' : current ? 'bg-primary text-on-primary' : 'bg-sunken text-fg-2'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-label="done" /> : s.num}
              </span>
              {s.label}
            </li>
          )
        })}
      </ol>

      <div className="min-h-[22rem] space-y-5 p-5 sm:p-6">
        {step === 1 && (
          <>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Project scope</h2>
              <p className="mt-1 text-sm text-fg-2">A clear title and description help the ranker find the right people.</p>
            </div>
            <div>
              <label htmlFor="mp-title" className="field-label">Project title</label>
              <input
                id="mp-title"
                type="text"
                required
                placeholder="e.g. High-throughput FastAPI microservice"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="mp-desc" className="field-label">Description</label>
              <textarea
                id="mp-desc"
                required
                rows={6}
                placeholder="Tasks, technical needs and deliverables"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Required skills</h2>
              <p className="mt-1 text-sm text-fg-2">Pick the skills the team needs. Add your own if they aren’t listed.</p>
            </div>

            {requiredSkills.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Selected skills">
                {requiredSkills.map(skill => (
                  <li key={skill}>
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-chip bg-shell pl-2.5 pr-1 text-[13px] font-medium text-on-dark">
                      {skill}
                      <button
                        type="button"
                        onClick={() => setRequiredSkills(prev => prev.filter(s => s !== skill))}
                        className="grid h-6 w-6 place-items-center rounded-md hover:bg-shell-3"
                        aria-label={`Remove ${skill}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <label htmlFor="mp-skill-search" className="sr-only">Search skills</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
                <input
                  id="mp-skill-search"
                  type="text"
                  placeholder="Search skills"
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex gap-2">
                <label htmlFor="mp-custom-skill" className="sr-only">Add a custom skill</label>
                <input
                  id="mp-custom-skill"
                  type="text"
                  placeholder="Add a custom skill"
                  value={customSkillInput}
                  onChange={e => setCustomSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
                  className="input"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  disabled={!customSkillInput.trim()}
                  className="btn btn-icon btn-secondary shrink-0"
                  aria-label="Add custom skill"
                >
                  <Plus aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex max-h-44 min-h-11 flex-wrap gap-1.5 overflow-y-auto rounded-field border border-line bg-sunken p-2">
              {filteredSkills.length === 0 ? (
                <p className="p-1 text-[13px] text-fg-2">
                  {availableSkills.length === 0 ? 'Loading skills' : 'No skills match your search. Add it as a custom skill.'}
                </p>
              ) : filteredSkills.map(skill => {
                const selected = requiredSkills.includes(skill)
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={selected}
                    className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                      selected ? 'border-shell bg-shell text-on-dark' : 'border-line bg-panel text-fg-2 hover:text-fg'
                    }`}
                  >
                    {skill}
                    {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )
              })}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="mp-team" className="field-label">Team size</label>
                <output htmlFor="mp-team" className="text-sm font-semibold tabular-nums text-fg">{teamSize} {teamSize === 1 ? 'person' : 'people'}</output>
              </div>
              <input
                id="mp-team"
                type="range"
                min="1"
                max="10"
                value={teamSize}
                onChange={e => setTeamSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Budget and timeline</h2>
              <p className="mt-1 text-sm text-fg-2">The team builder keeps the total cost within this budget.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mp-budget" className="field-label">Total budget (USD)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                  <input
                    id="mp-budget"
                    type="number"
                    required
                    min="100"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="input pl-6 tabular-nums"
                  />
                </div>
                <p className="field-hint">At least $100.</p>
              </div>
              <div>
                <label htmlFor="mp-deadline" className="field-label">Deadline (days)</label>
                <input
                  id="mp-deadline"
                  type="number"
                  required
                  min="1"
                  value={deadlineDays}
                  onChange={e => setDeadlineDays(Number(e.target.value))}
                  className="input tabular-nums"
                />
              </div>
            </div>
          </>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </div>

      <div className="flex justify-between gap-2 border-t border-line px-5 py-4 sm:px-6">
        <button
          type="button"
          disabled={step === 1 || loading}
          onClick={prevStep}
          className="btn btn-ghost"
        >
          Back
        </button>

        {step < 3 ? (
          <button
            key="btn-next"
            type="button"
            disabled={step === 1 && !title.trim()}
            onClick={nextStep}
            className="btn btn-primary"
          >
            Continue
          </button>
        ) : (
          <button key="btn-submit" type="submit" disabled={loading} className="btn btn-primary">
            {loading && <Spinner />}
            {loading ? 'Creating project…' : 'Create project and find matches'}
          </button>
        )}
      </div>
    </form>
  )
}
