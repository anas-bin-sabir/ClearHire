'use client'

interface Props {
  status: 'pending' | 'active' | 'completed' | 'cancelled' | string
}

export function StatusBadge({ status }: Props) {
  const normalized = status.toLowerCase()

  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    pending: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      label: 'Pending'
    },
    active: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
      border: 'border-indigo-500/20',
      label: 'Active'
    },
    completed: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      label: 'Completed'
    },
    cancelled: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/20',
      label: 'Cancelled'
    }
  }

  const activeConfig = config[normalized] || {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    label: status
  }

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${activeConfig.bg} ${activeConfig.text} ${activeConfig.border}`}
    >
      {activeConfig.label}
    </span>
  )
}
