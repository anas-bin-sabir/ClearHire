'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, TeamBuilderResponse, ProjectRecord } from '@/lib/api'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { fmt, fraudLabel, fraudTone } from '@/lib/utils'
import { AlertTriangle, Check, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, LoadingRows, Notice, Spinner } from '@/components/ui/States'
import { SkillBadge } from '@/components/ui/SkillBadge'

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
        setError(res.message || 'No team fits these constraints. Raise the budget or fraud cut-off, reduce the team size, or drop a skill.')
      }
      setLoading(false)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The team builder didn’t finish. Check the constraints and try again.')
      setLoading(false)
    }
  }

  const handleHireTeam = async () => {
    if (!response || !response.team || response.team.length === 0) return
    if (!selectedProjectId) {
      setError('Choose a project at the top of the form first. Contracts are created under that project.')
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
      setSuccessMsg('Team hired. An active contract was created for each member.')
      setResponse(null)
      setLoading(false)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The contracts weren’t created. Try hiring the team again.')
      setLoading(false)
    }
  }

  const filteredSkills = allSkills.filter(s => 
    s.toLowerCase().includes(skillQuery.toLowerCase())
  )

  // Presentation only: which required skills each proposed member covers.
  const coverage = response?.success
    ? requiredSkills.map(skill => ({
        skill,
        members: response.team.filter(m => m.skills?.some(s => s.toLowerCase() === skill.toLowerCase())).map(m => m.name),
      }))
    : []
  const uncovered = coverage.filter(c => c.members.length === 0)
  const budgetUse = response?.success && budget > 0 ? Math.min(response.total_cost / budget, 1) : 0

  return (
    <>
      <PageHeader
        title="Team builder"
        description="Set the budget, skills and trust threshold. The optimizer searches for a team that covers every skill and stays within budget, then you decide whether to hire it."
      />

      <form onSubmit={handleBuildTeam} className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Constraints */}
        <aside aria-label="Team constraints" className="space-y-5 self-start rounded-panel border border-line-2 bg-panel p-5 shadow-card lg:sticky lg:top-4">
          <div>
            <label htmlFor="tb-project" className="field-label">Project</label>
            <select
              id="tb-project"
              className="input"
              onChange={e => handleProjectSelect(Number(e.target.value))}
              value={selectedProjectId || ''}
            >
              <option value="">None (set constraints by hand)</option>
              {myProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <p className="field-hint">Choosing a project fills in its budget and skills, and lets you hire the team into it.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-line pt-5">
            <div className="col-span-2">
              <label htmlFor="tb-budget" className="field-label">Budget (USD)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                <input id="tb-budget" type="number" required min="100" value={budget} onChange={e => setBudget(Number(e.target.value))} className="input pl-6 tabular-nums" />
              </div>
            </div>
            <div>
              <label htmlFor="tb-hours" className="field-label">Hours each</label>
              <input id="tb-hours" type="number" min="10" max="200" value={hoursPerMember} onChange={e => setHoursPerMember(Number(e.target.value))} className="input tabular-nums" />
            </div>
            <div>
              <label htmlFor="tb-deadline" className="field-label">Deadline (days)</label>
              <input id="tb-deadline" type="number" min="1" value={deadlineDays} onChange={e => setDeadlineDays(Number(e.target.value))} className="input tabular-nums" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="tb-size" className="field-label">Team size</label>
              <output htmlFor="tb-size" className="text-sm font-semibold tabular-nums text-fg">{teamSize}</output>
            </div>
            <input id="tb-size" type="range" min="1" max="10" value={teamSize} onChange={e => setTeamSize(Number(e.target.value))} className="w-full" />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="tb-fraud" className="field-label">Fraud risk cut-off</label>
              <output htmlFor="tb-fraud" className="text-sm font-semibold tabular-nums text-fg">{Math.round(maxFraudScore * 100)}%</output>
            </div>
            <input id="tb-fraud" type="range" min="0.1" max="1.0" step="0.05" value={maxFraudScore} onChange={e => setMaxFraudScore(Number(e.target.value))} className="w-full" />
            <p className="field-hint">Freelancers scored above this aren’t considered.</p>
          </div>

          <div className="border-t border-line pt-5">
          <fieldset>
            <legend className="field-label">Required skills</legend>
            {requiredSkills.length > 0 && (
              <p className="mb-2 text-[13px] text-fg-2"><span className="font-semibold tabular-nums text-fg">{requiredSkills.length}</span> selected</p>
            )}
            <label htmlFor="tb-skill-filter" className="sr-only">Filter skills</label>
            <input
              id="tb-skill-filter"
              type="text"
              placeholder="Filter skills"
              value={skillQuery}
              onChange={e => setSkillQuery(e.target.value)}
              className="input mb-2"
            />
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-control border border-line bg-sunken p-2">
              {filteredSkills.length === 0 ? (
                <p className="p-1 text-xs text-fg-2">{allSkills.length === 0 ? 'Loading skills' : 'No skills match.'}</p>
              ) : filteredSkills.map(skill => {
                const active = requiredSkills.includes(skill)
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={active}
                    className={`min-h-7 rounded-md border px-2 text-xs font-medium transition-colors duration-150 ${
                      active ? 'border-shell bg-shell text-on-dark' : 'border-line bg-panel text-fg-2 hover:text-fg'
                    }`}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </fieldset>
          </div>

          <button type="submit" disabled={loading || requiredSkills.length === 0} className="btn btn-primary w-full">
            {loading && <Spinner />}
            {loading ? 'Building team…' : 'Build team'}
          </button>
          {requiredSkills.length === 0 && <p className="-mt-3 text-center text-xs text-fg-2">Select at least one skill.</p>}
        </aside>

        {/* Result */}
        <section aria-label="Proposed team" aria-busy={loading} className="min-w-0 space-y-4">
          {successMsg && <Notice tone="ok">{successMsg}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}

          {loading ? (
            <div className="rounded-panel border border-line-2 bg-panel p-6 shadow-card">
              <LoadingRows rows={4} label="Building team" />
            </div>
          ) : !response ? (
            !successMsg && (
              <EmptyState
                icon={<Users aria-hidden />}
                title="No team proposed yet"
                description="Pick a project or set a budget and skills, then choose Build team."
              />
            )
          ) : response.success ? (
            <>
              {/* Constraint check: budget and coverage */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel title="Budget">
                  <p className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold leading-none tabular-nums text-fg">{fmt.currency(response.total_cost)}</span>
                    <span className="text-sm text-fg-2">of {fmt.currency(budget)}</span>
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <div className={`h-full rounded-full ${response.total_cost > budget ? 'bg-danger' : 'bg-teal'}`} style={{ width: `${budgetUse * 100}%` }} />
                  </div>
                  <p className="mt-2 text-[13px] text-fg-2">
                    {response.total_cost <= budget
                      ? `${fmt.currency(budget - response.total_cost)} left, at ${hoursPerMember} hours per member.`
                      : `${fmt.currency(response.total_cost - budget)} over budget.`}
                  </p>
                </Panel>
                <Panel title="Skill coverage" description={uncovered.length === 0 ? 'Every required skill is covered.' : `${uncovered.length} required ${uncovered.length === 1 ? 'skill isn’t' : 'skills aren’t'} covered.`}>
                  <ul className="space-y-1.5 text-[13px]">
                    {coverage.map(c => (
                      <li key={c.skill} className="flex items-start gap-2">
                        {c.members.length > 0 ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="covered" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="not covered" />
                        )}
                        <span className="font-semibold text-fg">{c.skill}</span>
                        <span className="min-w-0 truncate text-fg-2">{c.members.length > 0 ? c.members.join(', ') : 'No member'}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              {/* Members */}
              <Panel
                title={`Proposed team of ${response.team.length}`}
                description={`Found after exploring ${response.nodes_explored.toLocaleString()} options with ${response.backtracks.toLocaleString()} backtracks.`}
                flush
              >
                <ul className="divide-y divide-line">
                  {response.team.map(member => (
                    <li key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={member.name} tone="color" />
                        <div className="min-w-0">
                          <Link href={`/client/freelancers/${member.id}`} className="font-semibold text-fg hover:underline">{member.name}</Link>
                          <ul className="mt-1 flex flex-wrap gap-1" aria-label="Skills">
                            {member.skills.slice(0, 6).map(s => (
                              <li key={s}><SkillBadge skill={s} highlighted={requiredSkills.some(r => r.toLowerCase() === s.toLowerCase())} /></li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-[13px] sm:justify-end">
                        <Badge tone={fraudTone(member.fraud_score)}>{fraudLabel(member.fraud_score)}</Badge>
                        <span className="tabular-nums text-fg-2">{fmt.rate(member.hourly_rate)}</span>
                        <span className="w-20 text-right font-semibold tabular-nums text-fg">{fmt.currency(member.hourly_rate * hoursPerMember)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {response.collaborations && response.collaborations.length > 0 && (
                  <div className="border-t border-line px-5 py-4">
                    <div className="ai-rule">
                      <p className="text-[13px] font-semibold text-fg">Have worked together</p>
                      <ul className="mt-1.5 space-y-1 text-[13px] text-fg-2">
                        {response.collaborations.map(c => (
                          <li key={`${c.a_id}-${c.b_id}`}>
                            <span className="text-fg">{c.a_name} and {c.b_name}</span> on {c.project_titles.join(', ') || `${c.count} project${c.count === 1 ? '' : 's'}`}
                            {c.avg_rating != null && <span className="tabular-nums">, rated {c.avg_rating.toFixed(1)}</span>}
                          </li>
                        ))}
                      </ul>
                      {response.graph_source && <p className="mt-1.5 text-xs text-fg-2">From the {response.graph_source} knowledge graph.</p>}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13px] text-fg-2">
                    {selectedProjectId
                      ? `Creates an active contract for each member under ${myProjects.find(p => p.id === selectedProjectId)?.title ?? 'the selected project'}.`
                      : 'Choose a project in the form to hire this team into it.'}
                  </p>
                  <button type="button" onClick={handleHireTeam} className="btn btn-primary shrink-0">
                    Hire this team
                  </button>
                </div>
              </Panel>

              {response.explanation && (
                <AIReasoningBox explanation={response.explanation} title="How the optimizer chose this team" defaultOpen />
              )}
            </>
          ) : (
            <EmptyState
              icon={<AlertTriangle aria-hidden />}
              title="No team fits these constraints"
              description={response.message || 'No combination of freelancers covers the skills within the budget and fraud cut-off. Raise the budget, reduce the team size, or remove a skill.'}
            />
          )}
        </section>
      </form>
    </>
  )
}
