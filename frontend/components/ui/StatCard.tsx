import { Children } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon?: LucideIcon
  description?: string
  /** Emphasize the figure (e.g. a count that needs action). */
  tone?: 'default' | 'danger' | 'ok'
}

/**
 * A single figure with its label. Used in a row inside one Panel, separated by
 * dividers, rather than as a grid of identical floating cards.
 */
export function StatCard({ label, value, icon: Icon, description, tone = 'default' }: Props) {
  // Sits on the charcoal strip: lime marks a good figure, signal red one that needs action.
  const valueColor = tone === 'danger' ? 'text-signal-on-dark' : tone === 'ok' ? 'text-primary' : 'text-on-dark'
  return (
    <div className="min-w-0 px-5 py-5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-on-dark-2">
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        {label}
      </p>
      <p className={`font-display mt-2 text-[40px] leading-none tabular-nums ${valueColor}`}>{value}</p>
      {description && <p className="mt-2 text-xs text-on-dark-2">{description}</p>}
    </div>
  )
}

const LG_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

/** Charcoal strip of figures, split by hairlines. */
export function StatStrip({ children }: { children: React.ReactNode }) {
  const count = Children.count(children)
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-line-dark ${LG_COLS[count] ?? 'lg:grid-cols-4'} [&>*]:bg-shell [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1`}
    >
      {children}
    </div>
  )
}
