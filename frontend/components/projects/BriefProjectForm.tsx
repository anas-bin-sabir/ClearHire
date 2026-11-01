'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { Notice, Spinner } from '@/components/ui/States'
import {
  api,
  BudgetType,
  GroundedSkill,
  ProjectExtractionResponse,
  Seniority,
} from '@/lib/api'

const EXAMPLE =
  'We need an MVP built in 6 weeks for an AI healthcare startup under $15k. Stack: React, ' +
  'FastAPI and Postgres, plus HIPAA experience. Team of 3 senior developers. Docker is a nice to have.'

interface SkillDraft {
  name: string
  input: string
  importance: 'must' | 'nice'
  match: GroundedSkill['match']
  confidence: number
}

interface Draft {
  title: string
  summary: string
  skills: SkillDraft[]
  budget: string
  budgetType: BudgetType
  deadlineDays: string
  teamSize: number
  seniority: Seniority
  domain: string
  compliance: string[]
  constraints: string[]
}

function toDraft(res: ProjectExtractionResponse): Draft {
  return {
    title: res.title,
    summary: res.summary,
    skills: res.skills.map(s => ({
      name: s.canonical ?? s.input,
      input: s.input,
      importance: s.importance,
      match: s.match,
      confidence: s.confidence,
    })),
    budget: res.budget != null ? String(res.budget) : '',
    budgetType: res.budget_type,
    deadlineDays: res.deadline_days != null ? String(res.deadline_days) : '',
    teamSize: res.team_size,
    seniority: res.seniority_level,
    domain: res.domain ?? '',
    compliance: res.compliance,
    constraints: res.implicit_constraints,
  }
}

function SkillChip({
  skill,
  onToggle,
  onRemove,
}: {
  skill: SkillDraft
  onToggle: () => void
  onRemove: () => void
}) {
  const custom = skill.match === 'none'
  const renamed = !custom && skill.input.toLowerCase() !== skill.name.toLowerCase()
  const tone = custom
    ? 'border-dashed border-warn/50 bg-warn-tint text-warn'
    : skill.importance === 'must'
      ? 'border-transparent bg-shell text-on-dark'
      : 'border-line bg-panel text-fg'
  const note = custom
    ? 'Not in the skill taxonomy; kept as a custom requirement.'
    : skill.match === 'semantic'
      ? `Matched by meaning, ${Math.round(skill.confidence * 100)}% similar.`
      : ''
  return (
    <span className={`inline-flex min-h-8 items-center gap-1 rounded-chip border pl-2.5 pr-1 text-[13px] font-medium ${tone}`} title={note || undefined}>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-sm"
        aria-label={`${skill.name}, ${skill.importance === 'must' ? 'must-have' : 'nice-to-have'}. ${note} Switch to ${skill.importance === 'must' ? 'nice-to-have' : 'must-have'}`}
      >
        {skill.name}
        {renamed && <span className="ml-1 font-normal opacity-70">from “{skill.input}”</span>}
        {skill.match === 'semantic' && <span className="ml-1 font-normal tabular-nums opacity-70">{Math.round(skill.confidence * 100)}%</span>}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${skill.name}`}
        className="grid h-6 w-6 place-items-center rounded-md opacity-70 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  )
}

export function BriefProjectForm() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProjectExtractionResponse | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [taxonomy, setTaxonomy] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [newCompliance, setNewCompliance] = useState('')

  useEffect(() => {
    api.freelancers
      .skills()
      .then(res => setTaxonomy(res.skills || []))
      .catch(() => setTaxonomy([]))
  }, [])

  const update = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d))

  const extract = async () => {
    setExtracting(true)
    setError(null)
    try {
      const res = await api.projects.extract(brief)
      setResult(res)
      setDraft(toDraft(res))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  const addSkill = () => {
    const name = newSkill.trim()
    if (!draft || !name) return
    const known = taxonomy.find(s => s.toLowerCase() === name.toLowerCase())
    if (!draft.skills.some(s => s.name.toLowerCase() === (known ?? name).toLowerCase())) {
      update({
        skills: [
          ...draft.skills,
          {
            name: known ?? name,
            input: name,
            importance: 'must',
            match: known ? 'exact' : 'none',
            confidence: known ? 1 : 0,
          },
        ],
      })
    }
    setNewSkill('')
  }

  const addCompliance = () => {
    const item = newCompliance.trim()
    if (draft && item && !draft.compliance.includes(item)) {
      update({ compliance: [...draft.compliance, item] })
    }
    setNewCompliance('')
  }

  const budgetValue = Number(draft?.budget)
  const deadlineValue = Number(draft?.deadlineDays)
  const canCreate =
    !!draft &&
    draft.title.trim().length > 0 &&
    budgetValue > 0 &&
    (draft.deadlineDays === '' || (deadlineValue >= 1 && deadlineValue <= 365))

  const create = async () => {
    if (!draft || !canCreate) return
    setCreating(true)
    setError(null)
    try {
      const { project } = await api.projects.create({
        title: draft.title.trim(),
        description: brief.trim(),
        required_skills: draft.skills.filter(s => s.importance === 'must').map(s => s.name),
        nice_to_have_skills: draft.skills.filter(s => s.importance === 'nice').map(s => s.name),
        budget: budgetValue,
        budget_type: draft.budgetType,
        deadline_days: draft.deadlineDays === '' ? undefined : deadlineValue,
        team_size: draft.teamSize,
        seniority_level: draft.seniority,
        domain: draft.domain.trim() || null,
        compliance: draft.compliance,
        implicit_constraints: draft.constraints,
      })
      router.push(`/client/search?projectId=${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project')
      setCreating(false)
    }
  }

  if (!draft || !result) {
    return (
      <div className="rounded-panel border border-line-2 bg-panel shadow-card">
        <div className="p-5 sm:p-6">
          <label htmlFor="brief-text" className="text-[15px] font-semibold text-fg">
            What do you need built?
          </label>
          <p id="brief-help" className="mt-1 max-w-prose text-sm text-fg-2">
            Write it the way you’d explain it to a colleague: what you’re building, the stack, budget,
            timeline and team size. You’ll review everything ClearHire extracts before it’s saved.
          </p>
          <textarea
            id="brief-text"
            aria-describedby="brief-help"
            rows={9}
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={EXAMPLE}
            maxLength={10000}
            className="input mt-4 min-h-56 text-[15px] leading-relaxed"
          />
          <p className="mt-2 text-right text-xs tabular-nums text-fg-2">{brief.length.toLocaleString()} / 10,000</p>
        </div>
        {error && <div className="px-5 pb-4 sm:px-6"><Notice tone="danger">{error}</Notice></div>}
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button type="button" onClick={() => setBrief(EXAMPLE)} className="btn btn-ghost">
            Use an example brief
          </button>
          <button
            type="button"
            onClick={extract}
            disabled={extracting || brief.trim().length < 10}
            className="btn btn-primary"
          >
            {extracting ? <Spinner /> : <Sparkles aria-hidden />}
            {extracting ? 'Reading your brief…' : 'Extract requirements'}
          </button>
        </div>
      </div>
    )
  }

  const must = draft.skills.filter(s => s.importance === 'must')
  const nice = draft.skills.filter(s => s.importance === 'nice')
  const toggle = (name: string) =>
    update({
      skills: draft.skills.map(s =>
        s.name === name ? { ...s, importance: s.importance === 'must' ? 'nice' : 'must' } : s,
      ),
    })
  const remove = (name: string) => update({ skills: draft.skills.filter(s => s.name !== name) })

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* What the client wrote */}
      <aside className="self-start rounded-panel border border-line-2 bg-sunken p-5 xl:sticky xl:top-4">
        <h2 className="text-sm font-semibold text-fg">Your brief</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-2">{brief}</p>
        <button
          type="button"
          onClick={() => {
            setResult(null)
            setDraft(null)
          }}
          className="btn btn-sm btn-secondary mt-4"
        >
          <RotateCcw aria-hidden /> Edit brief
        </button>
      </aside>

      {/* What ClearHire extracted, editable */}
      <section aria-labelledby="extracted-heading" className="rounded-panel border border-line-2 bg-panel shadow-card">
        <div className="ai-rule mx-5 mt-5 sm:mx-6 sm:mt-6">
          <h2 id="extracted-heading" className="text-[15px] font-semibold text-fg">Extracted requirements</h2>
          <p className="mt-1 text-sm text-fg-2">
            {result.source === 'gemini' ? 'Read from your brief by Gemini.' : result.source === 'claude' ? 'Read from your brief by Claude.' : 'Read by the rule-based parser (no LLM was available).'}{' '}
            Correct anything that’s off. Select a skill to switch it between must-have and nice-to-have.
          </p>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {result.ambiguities.length > 0 && (
            <div className="rounded-field bg-warn-tint p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-warn">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Check these before creating the project
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-fg">
                {result.ambiguities.map(a => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="brief-title">Project title</label>
              <input
                id="brief-title"
                className="input"
                value={draft.title}
                maxLength={255}
                aria-invalid={draft.title.trim().length === 0}
                onChange={e => update({ title: e.target.value })}
              />
              {draft.title.trim().length === 0 && <p className="field-error">Give the project a title.</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="brief-summary">Summary</label>
              <textarea
                id="brief-summary"
                rows={2}
                className="input min-h-20"
                value={draft.summary}
                onChange={e => update({ summary: e.target.value })}
              />
            </div>
          </div>

          <fieldset className="space-y-3 border-t border-line pt-5">
            <legend className="sr-only">Skills</legend>
            <div>
              <p className="field-label">Must-have skills</p>
              <div className="flex min-h-8 flex-wrap gap-1.5">
                {must.length === 0 && <span className="self-center text-[13px] text-fg-2">None yet</span>}
                {must.map(s => (
                  <SkillChip key={s.name} skill={s} onToggle={() => toggle(s.name)} onRemove={() => remove(s.name)} />
                ))}
              </div>
            </div>
            <div>
              <p className="field-label">Nice-to-have skills</p>
              <div className="flex min-h-8 flex-wrap gap-1.5">
                {nice.length === 0 && <span className="self-center text-[13px] text-fg-2">None</span>}
                {nice.map(s => (
                  <SkillChip key={s.name} skill={s} onToggle={() => toggle(s.name)} onRemove={() => remove(s.name)} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 sm:max-w-sm">
              <label htmlFor="brief-new-skill" className="sr-only">Add a skill</label>
              <input
                id="brief-new-skill"
                list="taxonomy-skills"
                className="input"
                placeholder="Add a skill"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSkill()
                  }
                }}
              />
              <datalist id="taxonomy-skills">
                {taxonomy.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={addSkill}
                disabled={!newSkill.trim()}
                aria-label="Add skill"
                className="btn btn-icon btn-secondary shrink-0"
              >
                <Plus aria-hidden />
              </button>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="brief-budget">
                Budget ({draft.budgetType === 'hourly' ? 'USD per hour' : 'USD total'})
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                  <input
                    id="brief-budget"
                    type="number"
                    min={1}
                    className="input pl-6 tabular-nums"
                    placeholder="Required"
                    aria-invalid={!(budgetValue > 0)}
                    aria-describedby="brief-budget-error"
                    value={draft.budget}
                    onChange={e => update({ budget: e.target.value })}
                  />
                </div>
                <select
                  aria-label="Budget type"
                  className="input w-auto"
                  value={draft.budgetType}
                  onChange={e => update({ budgetType: e.target.value as BudgetType })}
                >
                  <option value="fixed">Fixed</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              {!(budgetValue > 0) && <p id="brief-budget-error" className="field-error">Enter a budget above zero.</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="brief-deadline">Deadline (days)</label>
              <input
                id="brief-deadline"
                type="number"
                min={1}
                max={365}
                className="input tabular-nums"
                placeholder="Optional"
                aria-invalid={draft.deadlineDays !== '' && !(deadlineValue >= 1 && deadlineValue <= 365)}
                value={draft.deadlineDays}
                onChange={e => update({ deadlineDays: e.target.value })}
              />
              {draft.deadlineDays !== '' && !(deadlineValue >= 1 && deadlineValue <= 365) && (
                <p className="field-error">Use a number of days between 1 and 365.</p>
              )}
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label" htmlFor="brief-team">Team size</label>
                <output htmlFor="brief-team" className="text-sm font-semibold tabular-nums text-fg">{draft.teamSize}</output>
              </div>
              <input
                id="brief-team"
                type="range"
                min={1}
                max={10}
                value={Math.min(draft.teamSize, 10)}
                onChange={e => update({ teamSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="brief-seniority">Seniority</label>
              <select
                id="brief-seniority"
                className="input"
                value={draft.seniority}
                onChange={e => update({ seniority: e.target.value as Seniority })}
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid-level</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="brief-domain">Industry</label>
              <input
                id="brief-domain"
                className="input"
                placeholder="e.g. Healthcare"
                maxLength={100}
                value={draft.domain}
                onChange={e => update({ domain: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="brief-compliance">Compliance</label>
              {draft.compliance.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {draft.compliance.map(c => (
                    <span key={c} className="inline-flex min-h-7 items-center gap-1 rounded-chip bg-teal-tint pl-2 pr-1 text-xs font-semibold text-teal-ink">
                      {c}
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() => update({ compliance: draft.compliance.filter(x => x !== c) })}
                        className="grid h-5 w-5 place-items-center rounded-md"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                id="brief-compliance"
                className="input"
                placeholder="Add, e.g. GDPR, then press Enter"
                value={newCompliance}
                onChange={e => setNewCompliance(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCompliance()
                  }
                }}
              />
            </div>
          </div>

          {draft.constraints.length > 0 && (
            <div className="border-t border-line pt-5">
              <p className="field-label">Other requirements</p>
              <ul className="divide-y divide-line rounded-field border border-line">
                {draft.constraints.map(c => (
                  <li key={c} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-fg">
                    <span>{c}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${c}`}
                      onClick={() => update({ constraints: draft.constraints.filter(x => x !== c) })}
                      className="btn btn-icon btn-sm btn-ghost"
                    >
                      <X aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <Notice tone="danger">{error}</Notice>}
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[13px] text-fg-2">Creating the project ranks candidates for it straight away.</p>
          <button
            type="button"
            onClick={create}
            disabled={!canCreate || creating}
            className="btn btn-primary"
          >
            {creating && <Spinner />}
            {creating ? 'Creating project…' : 'Create project and find matches'}
          </button>
        </div>
      </section>
    </div>
  )
}
