'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Role } from '@/lib/auth-users'
import { ArrowRight, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import ThemeToggle from '@/components/ThemeToggle'

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
        setError('Invalid credentials. Please try again.')
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
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-radial-from via-radial-via to-radial-to p-4 md:p-8 relative overflow-hidden">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>
      {/* Background glow spheres */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-electric/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-mint/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Split Layout Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl overflow-hidden glass-card flex flex-col md:flex-row p-3 gap-3 relative z-10 border border-white/5 shadow-2xl"
      >
        {/* LEFT PANEL: AUTH FORM & QUICK PASS */}
        <div className="flex-1 px-6 py-8 md:px-10 md:py-8 flex flex-col justify-between">
          <div>
            {/* Header / Brand */}
            <Link href="/" className="flex items-center gap-2.5 mb-8 self-start group transition-all">
              <img
                src="/clearhire-logo-rremoveBG.png"
                alt="CH Logo"
                className="h-9 w-9 object-contain shrink-0 group-hover:scale-105 duration-200"
              />
              <div>
                <h1 className="text-white font-bold text-lg tracking-tight">ClearHire</h1>
                <span className="text-[9px] text-electric font-mono tracking-widest font-semibold uppercase block -mt-1">AI Matchmaking</span>
              </div>
            </Link>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">Welcome Back</h2>
            <p className="text-xs text-slate-400 mb-6">Sign in to access your secure hiring and matching dashboard.</p>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded-lg bg-rose/10 border border-rose/20 text-rose text-xs flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label text-xs">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input 
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input input-with-icon w-full"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1">
                  <label className="input-label text-xs mb-0">Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input input-with-icon w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <motion.button 
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full btn btn-md btn-primary mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </motion.button>

              <div className="text-center mt-4 text-xs text-slate-400">
                Don't have an account?{' '}
                <Link href="/signup" className="text-electric hover:underline font-semibold ml-1">
                  Sign Up
                </Link>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT PANEL: ILLUSTRATION & FEATURES */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/5 rounded-2xl relative overflow-hidden flex-col justify-between p-10 text-white">
          <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-electric/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-15%] left-[-15%] w-80 h-80 bg-mint/3 rounded-full blur-3xl pointer-events-none" />
          
          <div className="h-6" />

          {/* Profile Image */}
          <div className="relative z-10 flex items-center justify-center select-none">
            <img
              src="/girl-img.png"
              alt="Freelancer Profile"
              className="w-full max-w-75 object-contain drop-shadow-2xl"
            />
          </div>

          {/* Features Highlights */}
          <div className="w-full max-w-md space-y-3 mt-6 relative z-10 select-none">
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl text-[11px] font-medium leading-relaxed border border-white/5 shadow-sm text-slate-300 flex items-start gap-2.5">
              <span className="text-electric text-sm shrink-0">✦</span>
              <span>AI-powered matchmaking connects verified clients with top-tier freelancer talents based on vectorized semantic profile matching.</span>
            </div>

            <div className="bg-white/3 backdrop-blur-md p-4 rounded-2xl text-[11px] font-medium leading-relaxed border border-white/5 shadow-sm text-slate-300 flex items-start gap-2.5">
              <span className="text-mint text-sm shrink-0">✦</span>
              <span>Bayesian model updates dynamically evaluate reputation signals and anomalies to mitigate contract fraud risk factors.</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
