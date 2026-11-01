'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Render as a right-hand sheet on wide screens (used by compare). */
  variant?: 'center' | 'sheet'
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Modal dialog with focus trap, Escape, backdrop click, and focus return. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', variant = 'center' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          firstItem.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' }[size]
  const position =
    variant === 'sheet'
      ? 'items-end sm:items-stretch sm:justify-end'
      : 'items-end sm:items-center sm:justify-center'
  const shape =
    variant === 'sheet'
      ? 'rounded-t-panel sm:rounded-none sm:rounded-l-panel sm:h-full max-h-[92dvh] sm:max-h-none'
      : 'rounded-t-panel sm:rounded-panel max-h-[92dvh] sm:max-h-[85dvh]'

  return (
    <div className={`fixed inset-0 z-50 flex ${position} ${variant === 'sheet' ? '' : 'sm:p-4'}`}>
      <div className="absolute inset-0 bg-shell/60" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative flex w-full flex-col bg-panel shadow-menu outline-none ${width} ${shape}`}
        style={{ animation: 'rise 180ms ease-out' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-fg">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-fg-2">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-icon btn-sm btn-ghost -mr-2" aria-label="Close">
            <X aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  )
}
