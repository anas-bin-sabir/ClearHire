import type { BadgeTone } from '@/components/ui/Badge'

export const fmt = {
  currency: (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  rate: (n: number) => `$${n}/hr`,
  pct: (n: number) => `${Math.round(n * 100)}%`,
  timeAgo: (iso: string) => {
    if (!iso) return 'N/A'
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    const hours = Math.floor(s / 3600)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  },
  monthlyCtc: (rate: number) => rate * 160,
  annualCtc: (rate: number) => rate * 160 * 12,
}

/** Fraud score is a model signal, not a verdict. Thresholds match the backend's flagging. */
export const fraudTone = (score: number): BadgeTone =>
  score > 0.65 ? 'danger' : score > 0.35 ? 'warn' : 'ok'

export const fraudLabel = (score: number) =>
  score > 0.65 ? 'Flagged' : score > 0.35 ? 'Needs review' : 'Low risk'

export const contractTone: Record<string, BadgeTone> = {
  pending: 'warn',
  active: 'ai',
  completed: 'ok',
  cancelled: 'danger',
}
