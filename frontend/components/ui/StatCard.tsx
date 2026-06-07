'use client'

import { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  color?: 'electric' | 'mint' | 'rose' | 'amber'
  description?: string
}

export function StatCard({ label, value, icon: Icon, color = 'electric', description }: Props) {
  const colorMap = {
    electric: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    mint: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  }

  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
          <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-xl border ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {description && (
        <span className="text-xs font-medium text-slate-500">{description}</span>
      )}
    </div>
  )
}
