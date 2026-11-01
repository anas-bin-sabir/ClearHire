'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { AuthFrame } from '@/components/layout/AuthFrame'
import { Segmented } from '@/components/ui/Segmented'
import { Notice, Spinner } from '@/components/ui/States'

export default function SignupPage() {
  const router = useRouter()
  
  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'client' | 'freelancer'>('client')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Status states
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.')
      setLoading(false)
      return
    }

    if (!agreeTerms) {
      setError('Agree to the terms to create an account.')
      setLoading(false)
      return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to sign up. Please try again.')
      }

      setSuccess('Account created. Taking you to sign in…')
      
      // Clear form
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'The account wasn’t created. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  return (
    <AuthFrame>
      <h1 className="text-[28px] font-bold tracking-tight text-fg">Create an account</h1>
      <p className="mt-1.5 text-sm text-fg-2">Choose how you’ll use ClearHire.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice tone="ok">{success}</Notice>}

        <div>
          <p className="field-label">I want to</p>
          <Segmented
            label="Account type"
            value={role}
            onChange={setRole}
            fill
            options={[
              { value: 'client', label: 'Hire talent' },
              { value: 'freelancer', label: 'Find work' },
            ]}
          />
        </div>

        <div>
          <label htmlFor="signup-name" className="field-label">Full name</label>
          <input id="signup-name" type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="input" />
        </div>

        <div>
          <label htmlFor="signup-email" className="field-label">Email</label>
          <input id="signup-email" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} className="input" />
        </div>

        <div>
          <label htmlFor="signup-password" className="field-label">Password</label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              aria-describedby="signup-password-hint"
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
          <p id="signup-password-hint" className="field-hint">At least 8 characters, with a letter and a number.</p>
        </div>

        <div>
          <label htmlFor="signup-confirm" className="field-label">Confirm password</label>
          <input
            id="signup-confirm"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            aria-invalid={mismatch}
            aria-describedby={mismatch ? 'signup-confirm-error' : undefined}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="input"
          />
          {mismatch && <p id="signup-confirm-error" className="field-error">Passwords don’t match.</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-2">
          <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>I agree to the terms and conditions and the privacy policy.</span>
        </label>

        <button type="submit" disabled={loading || !!success} className="btn btn-lg btn-primary w-full">
          {loading ? <><Spinner /> Creating account</> : `Create ${role} account`}
        </button>
      </form>

      <p className="mt-8 text-sm text-fg-2">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary-ink hover:underline">Sign in</Link>
      </p>
    </AuthFrame>
  )
}
