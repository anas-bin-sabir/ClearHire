'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
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
    ? 'border-dashed border-amber-400/50 text-amber-400 bg-amber-400/5'
    : skill.importance === 'must'
      ? 'border-electric/40 bg-electric/15 text-white'
      : 'border-white/10 bg-slate-900/60 text-slate-300'
  const title = custom
    ? 'Not in the skill taxonomy; kept as a custom requirement'
    : skill.match === 'semantic'
      ? `Matched by meaning (${Math.round(skill.confidence * 100)}% similar)`
      : 'Click to toggle must-have / nice-to-have'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${tone}`}
      title={title}
    >
      <button type="button" onClick={onToggle} className="cursor-pointer">
        {skill.name}
        {renamed && <span className="text-slate-500 ml-1">← {skill.input}</span>}
        {skill.match === 'semantic' && (
          <span className="text-slate-500 ml-1">~{Math.round(skill.confidence * 100)}%</span>
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${skill.name}`}
        className="text-slate-500 hover:text-white cursor-pointer"
      >
        <X className="h-3 w-3" />
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
      <div className="glass-card p-8 space-y-5">
        <div>
          <h3 className="text-base font-bold text-white mb-1">Describe your project</h3>
          <p className="text-xs text-slate-400">
            Write it the way you would explain it to a colleague: what you are building,
            the stack, budget, timeline and team size. You will review everything before it
            is saved.
          </p>
        </div>
        <textarea
          rows={7}
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder={EXAMPLE}
          maxLength={10000}
          className="input resize-y"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setBrief(EXAMPLE)}
            className="btn btn-sm btn-ghost text-slate-400"
          >
            Use example
          </button>
          <button
            type="button"
            onClick={extract}
            disabled={extracting || brief.trim().length < 10}
            className="btn btn-md btn-primary flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
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
    <div className="glass-card p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white mb-1">Review extracted requirements</h3>
          <p className="text-xs text-slate-400">
            Edit anything that is off. Click a skill to switch it between must-have and
            nice-to-have.
          </p>
        </div>
        <span
          className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-white/10 text-slate-400"
          title={
            result.source === 'claude'
              ? 'Extracted by Claude'
              : 'Extracted by the rule-based parser (no LLM available)'
          }
        >
          {result.source === 'claude' ? 'Claude' : 'Rule-based'}
        </span>
      </div>

      {result.ambiguities.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
            <AlertTriangle className="h-4 w-4" /> Please confirm
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
            {result.ambiguities.map(a => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="input-label" htmlFor="brief-title">Project title</label>
          <input
            id="brief-title"
            className="input"
            value={draft.title}
            maxLength={255}
            onChange={e => update({ title: e.target.value })}
          />
        </div>
        <div>
          <label className="input-label" htmlFor="brief-summary">Summary</label>
          <textarea
            id="brief-summary"
            rows={2}
            className="input resize-y"
            value={draft.summary}
            onChange={e => update({ summary: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="input-label">Must-have skills</p>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {must.length === 0 && <span className="text-xs text-slate-500">None yet</span>}
          {must.map(s => (
            <SkillChip key={s.name} skill={s} onToggle={() => toggle(s.name)} onRemove={() => remove(s.name)} />
          ))}
        </div>
        <p className="input-label">Nice-to-have skills</p>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {nice.length === 0 && <span className="text-xs text-slate-500">None</span>}
          {nice.map(s => (
            <SkillChip key={s.name} skill={s} onToggle={() => toggle(s.name)} onRemove={() => remove(s.name)} />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            list="taxonomy-skills"
            className="input text-xs flex-1"
            placeholder="Add a skill…"
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
            className="btn btn-sm btn-ghost px-3 border border-electric/20 text-electric"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label" htmlFor="brief-budget">
            Budget ({draft.budgetType === 'hourly' ? 'USD per hour' : 'USD total'})
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                id="brief-budget"
                type="number"
                min={1}
                className={`input pl-9 font-mono ${budgetValue > 0 ? '' : 'border-amber-400/50'}`}
                placeholder="Required"
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
        </div>
        <div>
          <label className="input-label" htmlFor="brief-deadline">Deadline (days)</label>
          <input
            id="brief-deadline"
            type="number"
            min={1}
            max={365}
            className="input font-mono"
            placeholder="Optional"
            value={draft.deadlineDays}
            onChange={e => update({ deadlineDays: e.target.value })}
          />
        </div>
        <div>
          <label className="input-label" htmlFor="brief-team">
            Team size: <strong className="text-white">{draft.teamSize}</strong>
          </label>
          <input
            id="brief-team"
            type="range"
            min={1}
            max={10}
            value={Math.min(draft.teamSize, 10)}
            onChange={e => update({ teamSize: Number(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-electric"
          />
        </div>
        <div>
          <label className="input-label" htmlFor="brief-seniority">Seniority</label>
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
          <label className="input-label" htmlFor="brief-domain">Industry</label>
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
          <p className="input-label flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Compliance
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {draft.compliance.map(c => (
              <span key={c} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-mint/30 text-mint">
                {c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() => update({ compliance: draft.compliance.filter(x => x !== c) })}
                  className="cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            className="input text-xs"
            placeholder="Add (e.g. GDPR) and press Enter"
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
        <div>
          <p className="input-label">Other requirements</p>
          <ul className="space-y-1">
            {draft.constraints.map(c => (
              <li key={c} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                <span>{c}</span>
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() => update({ constraints: draft.constraints.filter(x => x !== c) })}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex justify-between border-t border-white/5 pt-6">
        <button
          type="button"
          onClick={() => {
            setResult(null)
            setDraft(null)
          }}
          className="btn btn-md btn-ghost flex items-center gap-1.5"
        >
          <RotateCcw className="h-4 w-4" /> Edit brief
        </button>
        <button
          type="button"
          onClick={create}
          disabled={!canCreate || creating}
          className="btn btn-md btn-primary flex items-center gap-2"
        >
          {creating ? 'Creating project…' : 'Create & find matches'}
          {!creating && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
