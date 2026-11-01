'use client'

import { useSyncExternalStore, useState } from 'react'

const STORAGE_KEY = 'cookie-consent'

export function CookieConsentBanner() {
  const stored = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem(STORAGE_KEY),
    () => 'pending-hydration',
  )
  const [dismissed, setDismissed] = useState(false)

  function handleChoice(choice: 'accepted' | 'declined') {
    localStorage.setItem(STORAGE_KEY, choice)
    setDismissed(true)
  }

  if (stored !== null || dismissed) return null

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-panel border border-line-dark bg-shell p-4 text-on-dark shadow-menu sm:flex sm:items-center sm:gap-6"
    >
      <p className="text-sm leading-relaxed text-on-dark-2">
        We use cookies to keep you signed in and to understand how ClearHire is used. Details are in the{' '}
        <a href="/privacy" className="font-medium text-on-dark underline underline-offset-2">privacy policy</a>.
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button type="button" onClick={() => handleChoice('declined')} className="btn btn-sm btn-dark">
          Decline
        </button>
        <button type="button" onClick={() => handleChoice('accepted')} className="btn btn-sm btn-primary">
          Accept
        </button>
      </div>
    </div>
  )
}
