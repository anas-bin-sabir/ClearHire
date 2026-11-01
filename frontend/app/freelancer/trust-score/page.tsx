'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { AlertTriangle, Check } from 'lucide-react'
import { api, FraudResponse } from '@/lib/api'
import { FraudGauge } from '@/components/ui/FraudGauge'
import { AIReasoningBox } from '@/components/ui/AIReasoningBox'
import { PageBody, PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { signalLabel } from '@/lib/fraudSignals'

export default function TrustScorePage() {
  const { data: session } = useSession()
  const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

  const [fraud, setFraud] = useState<FraudResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    const loadFraud = async () => {
      try {
        const res = await api.fraud.get(flId)
        if (active) {
          setFraud(res)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load trust index score:', err)
        if (active) {
          setError(true)
          setLoading(false)
        }
      }
    }
    loadFraud()
    return () => {
      active = false
    }
  }, [flId])

  return (
    <>
      <PageHeader
        title="Trust score"
        description="ClearHire’s fraud model looks at your profile and history and estimates a risk score. Clients see it as a signal next to your matches; it isn’t a judgement."
      />
      <PageBody className="max-w-5xl space-y-6">
        {error && <ErrorState message="Your trust analysis couldn’t be loaded. Refresh the page to try again." />}

        {fraud?.is_flagged && (
          <div role="status" className="flex gap-3 rounded-panel bg-danger-tint p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="font-semibold text-danger">Your account is flagged for review</p>
              <p className="mt-0.5 text-sm text-fg">
                The score passed the review threshold, so an admin checks the account before it’s matched again.
                Completing your <Link href="/freelancer/profile/edit" className="font-semibold text-primary-ink underline underline-offset-2">profile</Link> helps.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
          <Panel title="Current score">
            {loading ? (
              <Skeleton className="mx-auto h-32 w-48" />
            ) : fraud ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <FraudGauge score={fraud.score} confidence={fraud.confidence} size="lg" />
                {fraud.ran_at && (
                  <p className="text-xs text-fg-2">
                    Last analysed <time dateTime={fraud.ran_at}>{new Date(fraud.ran_at).toLocaleDateString()}</time>
                  </p>
                )}
              </div>
            ) : null}
          </Panel>

          <Panel title="What the model found" description="Signals raise the score; each one is listed with the reason the model gave.">
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></div>
            ) : fraud ? (
              <div className="space-y-5">
                {fraud.signals.length > 0 ? (
                  <ul className="space-y-2.5">
                    {fraud.signals.map(sig => (
                      <li key={sig} className="flex gap-2 text-sm text-fg" title={sig}>
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
                        {signalLabel(sig)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex gap-2 text-sm text-fg">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
                    No fraud signals were triggered.
                  </p>
                )}

                {fraud.risk_factors && fraud.risk_factors.length > 0 && (
                  <div className="border-t border-line pt-4">
                    <p className="text-[13px] font-semibold text-fg">Risk factors</p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-fg-2 marker:text-warn">
                      {fraud.risk_factors.map((factor, idx) => (
                        <li key={idx}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </Panel>
        </div>

        {fraud?.explanation && (
          <AIReasoningBox explanation={fraud.explanation} title="The model’s explanation" defaultOpen />
        )}
      </PageBody>
    </>
  )
}
