'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Scale, Search, SlidersHorizontal, X } from 'lucide-react'
import { api, ProjectRecord, RankedMatch, RerankingInfo, SearchGraphInfo, SearchRequest } from '@/lib/api'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { CandidateRow } from '@/components/search/CandidateRow'
import { CompareDrawer } from '@/components/search/CompareDrawer'
import { EmptyState, ErrorState, LoadingRows, Spinner } from '@/components/ui/States'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')

  // A project link starts in the loading state; the effect below fetches its matches.
  const [loading, setLoading] = useState(() => Boolean(projectIdParam))
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Results
  const [results, setResults] = useState<RankedMatch[]>([])
  const [explanation, setExplanation] = useState<string>('')
  const [totalCandidates, setTotalCandidates] = useState<number | undefined>()
  const [reranking, setReranking] = useState<RerankingInfo | undefined>()
  const [graphInfo, setGraphInfo] = useState<SearchGraphInfo | null | undefined>()
  const [compareOpen, setCompareOpen] = useState(false)

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
  const [skillsLoaded, setSkillsLoaded] = useState(false)
  const [customSkillInput, setCustomSkillInput] = useState('')

  const executeSearch = async (body: SearchRequest) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const res = await api.search.run(body)
      setResults(res.freelancers || [])
      setExplanation(res.explanation || '')
      setTotalCandidates(res.total_candidates)
      setReranking(res.reranking)
      setGraphInfo(res.graph)
      setLoading(false)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'The search didn’t complete. Check your filters and run it again.')
      setLoading(false)
    }
  }

  useEffect(() => {
    api.freelancers.skills()
      .then(res => setAllSkills(res.skills || []))
      .catch(err => console.error('Failed to load skills:', err))
      .finally(() => setSkillsLoaded(true))

    // Handle project context if passed
    if (projectIdParam) {
      const pId = Number(projectIdParam)

      Promise.all([
        api.projects.get(pId),
        api.search.precomputed(pId),
      ])
        .then(([proj, precomputed]) => {
          setProject(proj)
          setHasSearched(true)

          if (precomputed.precomputed && precomputed.ranked_freelancers.length) {
            setResults(precomputed.ranked_freelancers)
            setTotalCandidates(precomputed.total_candidates)
            setReranking(precomputed.reranking)
            setGraphInfo(precomputed.graph)
          } else {
            // If no precomputed, pre-populate form and trigger search
            setQuery(proj.description || '')
            setSkills(proj.required_skills || [])
            setBudget(proj.budget || 5000)
            setTeamSize(proj.team_size || 1)

            executeSearch({
              query: proj.description || '',
              skills: proj.required_skills || [],
              minRate: 0,
              maxRate: 300,
              minRating: 0,
              availableOnly: true,
              maxFraud: 0.6,
              budget: proj.budget || 5000,
              team_size: proj.team_size || 1,
            })
          }
          setLoading(false)
        })
        .catch(err => {
          console.error('Failed to load project search context:', err)
          setError('This project’s matches didn’t load. Reload the page, or search manually below.')
          setLoading(false)
        })
    }
  }, [projectIdParam])

  const currentPayload = (): SearchRequest => ({
    query,
    skills,
    minRate,
    maxRate,
    minRating,
    availableOnly,
    maxFraud,
    budget,
    team_size: teamSize,
  })

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFiltersOpen(false)
    executeSearch(currentPayload())
  }

  const toggleFormSkill = (skill: string) => {
    setSkills(prev => (prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]))
  }

  const addCustomSkill = () => {
    const t = customSkillInput.trim()
    if (t && !skills.includes(t)) setSkills(prev => [...prev, t])
    setCustomSkillInput('')
  }

  const reloadAfterHire = () => {
    if (projectIdParam) {
      api.search.precomputed(Number(projectIdParam)).then(r => {
        setResults(r.ranked_freelancers || [])
        setReranking(r.reranking)
      })
    } else {
      executeSearch(currentPayload())
    }
  }

  const visibleSkills = useMemo(() => {
    const q = customSkillInput.trim().toLowerCase()
    return q ? allSkills.filter(s => s.toLowerCase().includes(q)) : allSkills
  }, [allSkills, customSkillInput])

  const wantedSkills = project?.required_skills?.length ? project.required_skills : skills
  const graphActive = graphInfo && (graphInfo.source === 'neo4j' || graphInfo.source === 'postgres')
  const expandedSummary = graphInfo
    ? Object.entries(graphInfo.expanded_skills)
        .map(([skill, rel]) => `${skill}: ${Object.keys(rel).slice(0, 5).join(', ')}`)
        .join('\n')
    : ''

  return (
    <form onSubmit={handleManualSearch} className="min-h-full">
      {/* Requirement banner: the query is the page's subject. */}
      <section className="m-3 rounded-panel bg-shell px-5 py-6 text-on-dark sm:m-4 sm:px-8 sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
          {project ? `Matches for ${project.title || `project #${project.id}`}` : 'Search & match'}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-on-dark-2">
          {project
            ? 'Ranked against this project’s required skills, budget and trust threshold. Refine the search below to re-rank.'
            : 'Describe who you need in plain language. ClearHire ranks the talent pool by skill fit, then explains each rank with evidence.'}
        </p>

        {project && (
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-on-dark-2">Required skills</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {(project.required_skills ?? []).map(s => (
                  <span key={s} className="rounded-chip bg-shell-3 px-2 py-0.5 text-xs font-medium">{s}</span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-on-dark-2">Budget</dt>
              <dd className="mt-1 font-semibold tabular-nums">${project.budget.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt className="text-on-dark-2">Team size</dt>
              <dd className="mt-1 font-semibold tabular-nums">{project.team_size}</dd>
            </div>
          </dl>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="search-query" className="sr-only">Describe who you need</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-dark-2" aria-hidden />
            <input
              id="search-query"
              type="text"
              placeholder="e.g. Python microservice engineer with Docker and Postgres"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="input input-dark min-h-12 pl-10 text-[15px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              aria-expanded={filtersOpen}
              aria-controls="search-filters"
              className="btn btn-dark min-h-12 flex-none px-3.5 lg:hidden"
            >
              <SlidersHorizontal aria-hidden /> Filters{skills.length > 0 ? ` (${skills.length})` : ''}
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary min-h-12 flex-1 px-4 sm:flex-none sm:px-6">
              {loading ? <Spinner /> : <Search aria-hidden />}
              {loading ? 'Ranking…' : 'Find matches'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 px-3 pb-8 sm:px-4 lg:grid-cols-[18rem_1fr] xl:grid-cols-[20rem_1fr]">
        {/* Filters */}
        <aside
          id="search-filters"
          aria-label="Search filters"
          className={`${filtersOpen ? 'block' : 'hidden'} self-start rounded-panel border border-line-2 bg-panel p-5 shadow-card lg:sticky lg:top-4 lg:block`}
        >
          <fieldset>
            <legend className="field-label">Skills</legend>
            {skills.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Selected skills">
                {skills.map(skill => (
                  <li key={skill}>
                    <span className="inline-flex items-center gap-1 rounded-chip bg-shell py-0.5 pl-2 pr-1 text-xs font-medium text-on-dark">
                      {skill}
                      <button
                        type="button"
                        onClick={() => setSkills(prev => prev.filter(s => s !== skill))}
                        className="grid h-5 w-5 place-items-center rounded-md hover:bg-shell-3"
                        aria-label={`Remove ${skill}`}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <label htmlFor="skill-input" className="sr-only">Find or add a skill</label>
              <input
                id="skill-input"
                type="text"
                placeholder="Find or add a skill"
                value={customSkillInput}
                onChange={e => setCustomSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomSkill()
                  }
                }}
                className="input"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                disabled={!customSkillInput.trim()}
                className="btn btn-icon btn-secondary shrink-0"
                aria-label="Add skill"
              >
                <Plus aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-control border border-line bg-sunken p-2">
              {!skillsLoaded ? (
                <p className="p-1 text-xs text-fg-2">Loading skills</p>
              ) : visibleSkills.length === 0 ? (
                <p className="p-1 text-xs text-fg-2">
                  {allSkills.length === 0 ? 'No skill list available. Type a skill and press Enter.' : 'No match. Press Enter to add it.'}
                </p>
              ) : (
                visibleSkills.map(skill => {
                  const active = skills.includes(skill)
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => toggleFormSkill(skill)}
                      aria-pressed={active}
                      className={`min-h-7 rounded-md border px-2 text-xs font-medium transition-colors duration-150 ${
                        active ? 'border-shell bg-shell text-on-dark' : 'border-line bg-panel text-fg-2 hover:text-fg'
                      }`}
                    >
                      {skill}
                    </button>
                  )
                })
              )}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-line pt-5">
            <legend className="sr-only">Rate and quality</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="min-rate" className="field-label">Min rate</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                  <input id="min-rate" type="number" min="0" value={minRate} onChange={e => setMinRate(Number(e.target.value))} className="input pl-6 tabular-nums" />
                </div>
              </div>
              <div>
                <label htmlFor="max-rate" className="field-label">Max rate</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                  <input id="max-rate" type="number" min="0" value={maxRate} onChange={e => setMaxRate(Number(e.target.value))} className="input pl-6 tabular-nums" />
                </div>
              </div>
            </div>
            <p className="field-hint">Hourly, in USD.</p>

            <div className="mt-4">
              <label htmlFor="min-rating" className="field-label">Minimum rating</label>
              <input
                id="min-rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={minRating}
                onChange={e => setMinRating(Number(e.target.value))}
                className="input tabular-nums"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label htmlFor="max-fraud" className="field-label">Fraud risk cut-off</label>
                <output htmlFor="max-fraud" className="text-sm font-semibold tabular-nums text-fg">{Math.round(maxFraud * 100)}%</output>
              </div>
              <input
                id="max-fraud"
                type="range"
                step="0.05"
                min="0"
                max="1"
                value={maxFraud}
                onChange={e => setMaxFraud(Number(e.target.value))}
                className="w-full"
              />
              <p className="field-hint">Candidates scored above this are left out.</p>
            </div>

            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-fg">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={e => setAvailableOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Only show available candidates
            </label>
          </fieldset>

          <button type="submit" disabled={loading} className="btn btn-primary mt-4 w-full">
            {loading ? 'Ranking…' : 'Apply filters'}
          </button>
        </aside>

        {/* Results */}
        <section aria-labelledby="results-heading" aria-busy={loading} className="min-w-0 space-y-4">
          {error && (
            <ErrorState
              message={error}
              onRetry={projectIdParam && !hasSearched ? undefined : () => executeSearch(currentPayload())}
            />
          )}

          {loading ? (
            <div className="rounded-panel border border-line-2 bg-panel p-6 shadow-card">
              <LoadingRows rows={5} label="Ranking candidates" />
            </div>
          ) : results.length === 0 ? (
            !error && (
              <EmptyState
                icon={<Search aria-hidden />}
                title={hasSearched ? 'No one matched these filters' : 'Start with a description'}
                description={
                  hasSearched
                    ? 'Widen the rate range, lower the minimum rating, raise the fraud risk cut-off, or remove a skill.'
                    : 'Write what the work needs above, or pick skills in the filters, then choose Find matches.'
                }
              />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <h2 id="results-heading" className="text-lg font-bold tracking-tight text-fg">
                    {results.length} ranked {results.length === 1 ? 'candidate' : 'candidates'}
                    {totalCandidates ? <span className="font-medium text-fg-2"> of {totalCandidates} considered</span> : null}
                  </h2>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-fg-2">
                    {reranking && (
                      <span title={reranking.error ?? undefined}>
                        {reranking.path === 'llm'
                          ? `Top ${reranking.top_n} reranked by AI fit`
                          : 'Ranked deterministically'}
                      </span>
                    )}
                    {graphActive && (
                      <span title={expandedSummary || undefined} className="text-teal-ink">
                        Skills expanded with the knowledge graph ({graphInfo?.source})
                      </span>
                    )}
                  </p>
                </div>
                {results.length >= 2 && (
                  <button type="button" onClick={() => setCompareOpen(true)} className="btn btn-sm btn-secondary">
                    <Scale aria-hidden /> Compare top 2
                  </button>
                )}
              </div>

              {explanation && <AIReasoningBox explanation={explanation} title="How these were ranked" />}

              <ol className="divide-y divide-line overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
                {results.map((fl, idx) => (
                  <CandidateRow
                    key={fl.id}
                    match={fl}
                    position={idx + 1}
                    wantedSkills={wantedSkills}
                    reasoningOpen={idx === 0}
                    onHireSuccess={reloadAfterHire}
                  />
                ))}
              </ol>

              <CompareDrawer
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                matches={results.slice(0, 2)}
                reranking={reranking}
              />
            </>
          )}
        </section>
      </div>
    </form>
  )
}
