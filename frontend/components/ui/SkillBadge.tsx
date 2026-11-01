interface Props {
  skill: string
  /** Matches a requirement in the current context (search, project). */
  highlighted?: boolean
}

export function SkillBadge({ skill, highlighted = false }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-chip border px-2 py-0.5 text-xs font-medium ${
        highlighted ? 'border-teal/30 bg-teal-tint text-teal-ink' : 'border-line bg-sunken text-fg-2'
      }`}
    >
      {skill}
    </span>
  )
}
