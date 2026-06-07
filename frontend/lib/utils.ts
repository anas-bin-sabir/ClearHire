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

export const fraudColor = (score: number) =>
  score > 0.65 ? 'rose' : score > 0.35 ? 'amber' : 'mint'

export const fraudLabel = (score: number) =>
  score > 0.65 ? 'Flagged' : score > 0.35 ? 'Review' : 'Verified'

export const contractStatusColor: Record<string, string> = {
  pending: 'amber',
  active: 'electric',
  completed: 'mint',
  cancelled: 'rose',
}

