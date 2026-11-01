'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { FreelancerRecord } from '@/lib/api'
import { fraudLabel, fraudTone } from '@/lib/utils'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { SkillBadge } from './SkillBadge'
import { HireModal } from './HireModal'

interface Props {
  /** match_score is on the backend's 0–100 scale. */
  freelancer: FreelancerRecord & { match_score?: number; rank_score?: number }
  role: 'client' | 'admin' | 'freelancer'
  showHireAction?: boolean
  onHireSuccess?: () => void
  /** Skills to highlight as matching the current requirement. */
  highlightSkills?: string[]
}

export function FreelancerCard({ freelancer, role, showHireAction = false, onHireSuccess, highlightSkills = [] }: Props) {
  const [showHireModal, setShowHireModal] = useState(false)
  const wanted = new Set(highlightSkills.map(s => s.toLowerCase()))
  const skills = freelancer.skills || []

  return (
    <article className="flex flex-col rounded-panel border border-line-2 bg-panel p-5 shadow-card transition-shadow duration-200 hover:shadow-menu">
      <div className="flex items-start gap-3">
        <Avatar name={freelancer.name} tone="color" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-fg">{freelancer.name}</h3>
          <p className="mt-0.5 text-[13px] text-fg-2">
            {freelancer.experience_years} yrs experience{freelancer.location ? `, ${freelancer.location}` : ''}
          </p>
        </div>
        <p className="shrink-0 text-right text-[15px] font-bold tabular-nums text-fg">
          ${freelancer.hourly_rate}
          <span className="text-xs font-medium text-fg-2">/hr</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={fraudTone(freelancer.fraud_score)}>{fraudLabel(freelancer.fraud_score)}</Badge>
        {freelancer.review_count > 0 ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-fg-2">
            <Star className="h-3.5 w-3.5 fill-star text-star" aria-hidden />
            <span className="font-semibold tabular-nums text-fg">{freelancer.rating.toFixed(1)}</span>
            <span className="tabular-nums">({freelancer.review_count} reviews)</span>
          </span>
        ) : (
          <span className="text-[13px] text-fg-2">No reviews yet</span>
        )}
        {!freelancer.availability && <Badge>Unavailable</Badge>}
      </div>

      {freelancer.match_score !== undefined && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="text-fg-2">Match score</span>
            <span className="font-semibold tabular-nums text-teal-ink">{Math.round(freelancer.match_score)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <div className="h-full rounded-full bg-teal" style={{ width: `${Math.round(freelancer.match_score)}%` }} />
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
          {skills.slice(0, 6).map(skill => (
            <li key={skill}>
              <SkillBadge skill={skill} highlighted={wanted.has(skill.toLowerCase())} />
            </li>
          ))}
          {skills.length > 6 && <li className="self-center text-xs text-fg-2">+{skills.length - 6} more</li>}
        </ul>
      )}

      <div className="mt-auto flex gap-2 pt-5">
        <Link
          href={role === 'client' ? `/client/freelancers/${freelancer.id}` : `/freelancer/dashboard`}
          className="btn btn-secondary flex-1"
        >
          View profile
        </Link>
        {showHireAction && role === 'client' && (
          <button type="button" onClick={() => setShowHireModal(true)} className="btn btn-primary flex-1">
            Hire
          </button>
        )}
      </div>

      <HireModal
        open={showHireModal}
        freelancerId={freelancer.id}
        freelancerName={freelancer.name}
        onSuccess={() => {
          setShowHireModal(false)
          onHireSuccess?.()
        }}
        onClose={() => setShowHireModal(false)}
      />
    </article>
  )
}
