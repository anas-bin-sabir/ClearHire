function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** "dark" for the navy sidebar; "color" uses the indigo tint for people in lists. */
  tone?: 'dark' | 'color' | 'neutral'
}

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' }

/** Initials avatar. ClearHire has no profile photos, so we never fake one. */
export function Avatar({ name, size = 'md', tone = 'neutral' }: Props) {
  const toneClass =
    tone === 'dark'
      ? 'bg-shell-3 text-on-dark'
      : tone === 'color'
        ? 'bg-primary-tint text-primary-ink'
        : 'bg-sunken text-fg border border-line'
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold tracking-tight ${SIZES[size]} ${toneClass}`}
    >
      {initials(name)}
    </span>
  )
}
