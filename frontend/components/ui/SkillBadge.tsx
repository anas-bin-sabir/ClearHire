'use client'

interface Props {
  skill: string
  highlighted?: boolean
}

export function SkillBadge({ skill, highlighted = false }: Props) {
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        highlighted
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-slate-950/40 text-slate-300 border-white/5 hover:border-white/10'
      }`}
    >
      {skill}
    </span>
  )
}
