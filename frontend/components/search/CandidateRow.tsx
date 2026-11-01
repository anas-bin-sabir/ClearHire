'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Star } from 'lucide-react'
import type { RankedMatch } from '@/lib/api'
import { fraudLabel, fraudTone } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { HireModal } from '@/components/ui/HireModal'
import { MatchReasoning } from './MatchReasoning'

interface Props {
  match: RankedMatch
  position: number
  /** Skills from the current requirement; matching ones are highlighted. */
  wantedSkills: string[]
  reasoningOpen?: boolean
  onHireSuccess?: () => void
}

/**
 * One line of the ranked ledger: rank, identity, the match score with its bar,
 * trust signal, skills that meet the requirement, and the evidence behind the rank.
 */
export function CandidateRow({ match, position, wantedSkills, reasoningOpen = false, onHireSuccess }: Props) {
  const [open, setOpen] = useState(reasoningOpen)
  const [hiring, setHiring] = useState(false)
  const reasoningId = useId()
  const rank = match.rank ?? position
  const score = Math.round(match.match_score)
  const wanted = new Set(wantedSkills.map(s => s.toLowerCase()))
  const skills = [...(match.skills ?? [])].sort(
    (a, b) => Number(wanted.has(b.toLowerCase())) - Number(wanted.has(a.toLowerCase())),
  )
  const hasReasoning =
    !!match.reasoning &&
    (match.reasoning.strengths.length > 0 || match.reasoning.risks.length > 0 || !!match.reasoning.biggest_gap)

  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-x-3 px-4 py-5 sm:grid-cols-[3.5rem_1fr] sm:gap-x-4 sm:px-6">
      <p className="font-display pt-0.5 text-[30px] leading-none tabular-nums text-fg-3 sm:text-[38px]">
        <span className="sr-only">Rank </span>
        {String(rank).padStart(2, '0')}
      </p>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={match.name} tone="color" />
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-fg">{match.name}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-2">
                <span className="tabular-nums">{match.experience_years} yrs</span>
                {match.location && <span>{match.location}</span>}
                <span className="tabular-nums font-semibold text-fg">${match.hourly_rate}/hr</span>
                {match.review_count > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-star text-star" aria-hidden />
                    <span className="tabular-nums">
                      {match.rating.toFixed(1)} ({match.review_count})
                    </span>
                  </span>
                ) : (
                  <span>No reviews yet</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 sm:w-44 sm:flex-col sm:items-end sm:gap-2">
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-[30px] leading-none tabular-nums text-fg">{score}</span>
              <span className="text-xs text-fg-2">match score</span>
            </p>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sunken sm:w-full" aria-hidden>
              <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={fraudTone(match.fraud_score)}>
            {fraudLabel(match.fraud_score)}
            <span className="sr-only">, fraud risk {Math.round(match.fraud_score * 100)}%</span>
          </Badge>
          {!match.availability && <Badge>Unavailable</Badge>}
          {skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
              {skills.slice(0, 7).map(skill => (
                <li key={skill}>
                  <SkillBadge skill={skill} highlighted={wanted.has(skill.toLowerCase())} />
                </li>
              ))}
              {skills.length > 7 && <li className="self-center text-xs text-fg-2">+{skills.length - 7}</li>}
            </ul>
          )}
        </div>

        {hasReasoning && open && match.reasoning && (
          <div id={reasoningId} className="mt-4">
            <MatchReasoning reasoning={match.reasoning} deterministicScore={match.deterministic_match_score} graph={match.graph} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {hasReasoning && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls={reasoningId}
              className="btn btn-sm btn-ghost -ml-3 text-teal-ink"
            >
              <ChevronDown className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
              {open ? 'Hide evidence' : 'Why this rank'}
            </button>
          )}
          <span className="flex-1" />
          <Link href={`/client/freelancers/${match.id}`} className="btn btn-sm btn-secondary">
            View profile
          </Link>
          <button type="button" onClick={() => setHiring(true)} className="btn btn-sm btn-primary">
            Hire
          </button>
        </div>
      </div>

      <HireModal
        open={hiring}
        freelancerId={match.id}
        freelancerName={match.name}
        onClose={() => setHiring(false)}
        onSuccess={() => {
          setHiring(false)
          onHireSuccess?.()
        }}
      />
    </li>
  )
}
