'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cookie-consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const choice = localStorage.getItem(STORAGE_KEY)
    if (!choice) setVisible(true)
  }, [])

  function handleChoice(choice: 'accepted' | 'declined') {
    localStorage.setItem(STORAGE_KEY, choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/80">
          We use cookies to run this site and understand how it's used. See our{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </a>{' '}
          for details.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => handleChoice('declined')}
            className="btn-ghost px-4 py-1.5 rounded-lg text-sm"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => handleChoice('accepted')}
            className="btn-primary px-4 py-1.5 rounded-lg text-sm"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => handleChoice('declined')}
            aria-label="Dismiss"
            className="ml-1 text-foreground/50 hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
