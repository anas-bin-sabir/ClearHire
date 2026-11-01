'use client'

import { useId, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'

interface Props {
  explanation: string
  title?: string
  defaultOpen?: boolean
}

/** Collapsible machine-written explanation, marked with the teal AI rule. */
export function AIReasoningBox({ explanation, title = 'How ClearHire reached this', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <div className="ai-rule rounded-r-control bg-teal-tint/50 py-1 pr-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-control text-left text-sm font-semibold text-fg"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-ink" aria-hidden />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-fg-2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div id={id} className="max-w-prose space-y-2 pb-3 pt-1 text-sm leading-relaxed text-fg-2">
          {explanation.split('\n').filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
    </div>
  )
}
