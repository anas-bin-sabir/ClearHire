import { AlertTriangle, RotateCw } from 'lucide-react'

interface EmptyProps {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/** An empty screen is an invitation to act: say what's missing and how to fill it. */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyProps) {
  return (
    <div className={`flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center ${className}`}>
      {icon && <span className="text-fg-3 [&_svg]:h-6 [&_svg]:w-6">{icon}</span>}
      <div className="max-w-sm">
        <p className="text-[15px] font-semibold text-fg">{title}</p>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
      </div>
      {action}
    </div>
  )
}

interface ErrorProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = 'This section didn’t load', message, onRetry, className = '' }: ErrorProps) {
  return (
    <div role="alert" className={`flex flex-col gap-3 rounded-panel border border-danger/20 bg-danger-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-sm text-fg-2">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary shrink-0">
          <RotateCw aria-hidden /> Try again
        </button>
      )}
    </div>
  )
}

/** Inline form/action feedback. */
export function Notice({ tone, children }: { tone: 'ok' | 'danger' | 'warn' | 'ai'; children: React.ReactNode }) {
  const styles = {
    ok: 'bg-ok-tint text-ok',
    danger: 'bg-danger-tint text-danger',
    warn: 'bg-warn-tint text-warn',
    ai: 'bg-teal-tint text-teal-ink',
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-control px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

/** Rows of skeleton lines with an accessible busy label. */
export function LoadingRows({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}
