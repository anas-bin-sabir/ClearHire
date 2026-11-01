'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Role } from '@/lib/auth-users'
import { Eye, EyeOff } from 'lucide-react'
import { AuthFrame } from '@/components/layout/AuthFrame'
import { Notice, Spinner } from '@/components/ui/States'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError('That email and password don’t match an account. Check them and try again.')
        setLoading(false)
      } else {
        // Fetch session to determine role redirect
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()
        const role = session?.user?.role as Role
        if (role === 'client') router.push('/client/dashboard')
        else if (role === 'freelancer') router.push('/freelancer/dashboard')
        else if (role === 'admin') router.push('/admin/dashboard')
        else router.push('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Sign in didn’t complete. Try again.')
      setLoading(false)
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-[48px] text-fg">Sign in</h1>
      <p className="mt-1.5 text-sm text-fg-2">Use the email you registered with. You’ll land on your workspace.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}

        <div>
          <label htmlFor="login-email" className="field-label">Email</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="field-label">Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="btn btn-icon btn-sm btn-ghost absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-lg btn-primary w-full">
          {loading ? <><Spinner /> Signing in</> : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-sm text-fg-2">
        New to ClearHire?{' '}
        <Link href="/signup" className="font-semibold text-primary-ink hover:underline">Create an account</Link>
      </p>
    </AuthFrame>
  )
}
