'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, FreelancerRecord, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { SkillBadge } from '@/components/ui/SkillBadge'
import { HireModal } from '@/components/ui/HireModal'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Check, Link2, Star } from 'lucide-react'
import { signalLabel } from '@/lib/fraudSignals'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/States'

export default function FreelancerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const freelancerId = Number(params.id)

  const [freelancer, setFreelancer] = useState<FreelancerRecord | null>(null)
  const [fraud, setFraud] = useState<FraudResponse | null>(null)
  const [connectedSkills, setConnectedSkills] = useState<string[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showHireModal, setShowHireModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        const [fl, fr, graphRes] = await Promise.all([
          api.freelancers.get(freelancerId),
          api.fraud.get(freelancerId),
          api.graph()
        ])

        if (!active) return

        setFreelancer(fl)
        setFraud(fr)

        // Find connected skill nodes from the D3 graph data
        // Search links where source/target matches freelancer name or id node
        const flNodeId = `f-${freelancerId}`
        const connectedNodeIds = graphRes.links
          .filter(l => l.source === flNodeId || l.target === flNodeId)
          .map(l => l.source === flNodeId ? l.target : l.source)

        const skills = graphRes.nodes
          .filter(n => n.type === 'skill' && connectedNodeIds.includes(n.id))
          .map(n => n.name)

        setConnectedSkills(skills)
        setLoading(false)
      } catch (err: unknown) {
        console.error(err)
        if (active) {
          setError('This profile couldn’t be loaded. Go back and open it again.')
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [freelancerId])

  const back = (
    <Link href="/client/search" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-2 hover:text-fg">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Search & match
    </Link>
  )

  if (loading) {
    return (
      <div className="p-5 sm:p-8">
        {back}
        <div className="mt-6 max-w-xl"><LoadingRows rows={3} label="Loading profile" /></div>
      </div>
    )
  }

  if (!freelancer) {
    return (
      <div className="space-y-4 p-5 sm:p-8">
        {back}
        {error ? (
          <ErrorState message={error} />
        ) : (
          <EmptyState
            title="Freelancer not found"
            description="This profile may have been removed."
            action={<button type="button" onClick={() => router.back()} className="btn btn-sm btn-secondary">Go back</button>}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {/* Identity */}
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8 sm:pt-8">
        {back}
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={freelancer.name} size="lg" tone="color" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-[28px]">{freelancer.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-2">
                {freelancer.location && <span>{freelancer.location}</span>}
                <span className="tabular-nums">{freelancer.experience_years} years experience</span>
                {freelancer.availability ? <Badge tone="ok">Available</Badge> : <Badge>Unavailable</Badge>}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setShowHireModal(true)} className="btn btn-primary btn-lg shrink-0">
            Hire {freelancer.name.split(' ')[0]}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Profile facts, as entered by the freelancer */}
        <div className="min-w-0 space-y-6">
          <Panel title="Profile">
            <p className="max-w-prose text-[15px] leading-relaxed text-fg">
              {freelancer.bio || <span className="text-fg-2">No bio yet.</span>}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-fg-2">Hourly rate</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-fg">${freelancer.hourly_rate}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-2">Rating</dt>
                <dd className="mt-1 flex items-center gap-1 text-xl font-bold tabular-nums text-fg">
                  {freelancer.review_count > 0 ? (
                    <>
                      <Star className="h-4 w-4 fill-star text-star" aria-hidden />
                      {freelancer.rating.toFixed(1)}
                      <span className="text-[13px] font-medium text-fg-2">({freelancer.review_count})</span>
                    </>
                  ) : (
                    <span className="text-base font-medium text-fg-2">No reviews</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-2">Account age</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-fg">{freelancer.account_age_days} days</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Skills" description="Declared by the freelancer.">
            <ul className="flex flex-wrap gap-1.5">
              {freelancer.skills?.map(skill => (
                <li key={skill}><SkillBadge skill={skill} /></li>
              ))}
            </ul>
            {connectedSkills.length > 0 && (
              <div className="ai-rule mt-5">
                <p className="text-[13px] font-semibold text-fg">Linked in the knowledge graph</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {connectedSkills.map(skill => (
                    <li key={skill}><Badge tone="ai">{skill}</Badge></li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="Portfolio">
            {freelancer.portfolio_urls && freelancer.portfolio_urls.length > 0 ? (
              <ul className="divide-y divide-line">
                {freelancer.portfolio_urls.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary-ink hover:underline"
                    >
                      <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{url}</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-2">No portfolio links added.</p>
            )}
          </Panel>
        </div>

        {/* Model output, kept apart from profile facts */}
        <aside aria-labelledby="trust-heading" className="space-y-4 self-start lg:sticky lg:top-4">
          <Panel
            title={<span id="trust-heading">Trust analysis</span>}
            description="Output of ClearHire’s fraud model. A signal for review, not a verdict."
          >
            {fraud ? (
              <div className="space-y-5">
                <div className="flex justify-center">
                  <FraudGauge score={fraud.score} confidence={fraud.confidence} size="md" />
                </div>
                {fraud.is_flagged && (
                  <p role="status" className="flex gap-2 rounded-field bg-danger-tint p-3 text-[13px] font-medium text-danger">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    Flagged for admin review.
                  </p>
                )}
                <div className="border-t border-line pt-4">
                  <p className="text-[13px] font-semibold text-fg">Signals found</p>
                  {fraud.signals && fraud.signals.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {fraud.signals.map(sig => (
                        <li key={sig} className="flex gap-2 text-[13px] text-fg" title={sig}>
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
                          {signalLabel(sig)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 flex gap-2 text-[13px] text-fg-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
                      The model didn’t trigger any fraud signals.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-2">No trust analysis available for this profile.</p>
            )}
          </Panel>

          {fraud?.explanation && (
            <AIReasoningBox explanation={fraud.explanation} title="Why the model scored it this way" defaultOpen />
          )}
        </aside>
      </div>

      <HireModal
        open={showHireModal}
        freelancerId={freelancer.id}
        freelancerName={freelancer.name}
        onSuccess={() => {
          setShowHireModal(false)
          router.push('/client/contracts')
        }}
        onClose={() => setShowHireModal(false)}
      />
    </>
  )
}
