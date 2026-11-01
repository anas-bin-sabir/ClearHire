'use client'

interface Props {
  score: number
  confidence?: 'low' | 'medium' | 'high' | string | null
  size?: 'sm' | 'md' | 'lg'
}

const ARC = 'M15,80 A65,65 0 0,1 145,80'
const LENGTH = 204.2 // π·65

/** Half-circle meter for the fraud model's score. A signal for review, not a verdict. */
export function FraudGauge({ score, confidence, size = 'md' }: Props) {
  const clamped = Math.max(0, Math.min(score, 1))
  const pct = Math.round(clamped * 100)
  const color = clamped > 0.65 ? 'var(--status-danger)' : clamped > 0.35 ? 'var(--status-warn)' : 'var(--teal-ink)'
  const width = size === 'sm' ? 120 : size === 'lg' ? 200 : 160

  return (
    <figure className="flex flex-col items-center gap-1" aria-label={`Fraud risk ${pct}%${confidence ? `, ${confidence} confidence` : ''}`}>
      <svg width={width} height={(width * 90) / 160} viewBox="0 0 160 90" aria-hidden>
        <path d={ARC} fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" />
        <path
          d={ARC}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
        <text x="80" y="72" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </text>
      </svg>
      <figcaption className="text-center text-xs text-fg-2">
        Fraud risk{confidence ? `, ${confidence} confidence` : ''}
      </figcaption>
    </figure>
  )
}
