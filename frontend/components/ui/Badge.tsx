export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'ai' | 'dark' | 'primary'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-fg-2 border-line',
  ok: 'bg-ok-tint text-ok border-transparent',
  warn: 'bg-warn-tint text-warn border-transparent',
  danger: 'bg-danger-tint text-danger border-transparent',
  ai: 'bg-teal-tint text-teal-ink border-transparent',
  dark: 'bg-shell-2 text-on-dark border-line-dark',
  primary: 'bg-primary-tint text-primary-ink border-transparent',
}

interface Props {
  tone?: BadgeTone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', icon, children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5 ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}
