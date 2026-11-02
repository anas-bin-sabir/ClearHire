'use client'

import { useEffect } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import { setApiToken } from '@/lib/api'
import { ThemeProvider } from './ThemeProvider'

/** Keeps the API client's bearer token in step with login/logout. */
function ApiTokenSync() {
  const { data: session, status } = useSession()
  useEffect(() => {
    if (status !== 'loading') setApiToken(session?.accessToken)
  }, [session?.accessToken, status])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={4 * 60}>
      <ApiTokenSync />
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  )
}
