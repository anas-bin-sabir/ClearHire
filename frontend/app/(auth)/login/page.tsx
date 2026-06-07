'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEMO_USERS, Role } from '@/lib/auth-users'
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react'
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

  const handleDemoSignIn = async (demoEmail: string, role: Role) => {
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', {
      email: demoEmail,
      password: 'demo',
      redirect: false,
    })

    if (res?.error) {
      setError('Failed to log in as demo user.')
      setLoading(false)
    } else {
      if (role === 'client') router.push('/client/dashboard')
      else if (role === 'freelancer') router.push('/freelancer/dashboard')
      else if (role === 'admin') router.push('/admin/dashboard')
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
              <div className="h-9 w-9 rounded-lg bg-electric flex items-center justify-center text-white shadow-lg shadow-electric/25 group-hover:scale-105 duration-200">
                <Sparkles className="h-5 w-5" />
              </div>
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
                <div className="flex justify-between items-center mb-1">
                  <label className="input-label text-xs mb-0">Password</label>
                  <Link href="#" className="text-[11px] text-electric hover:underline font-semibold">
                    Forgot password?
                  </Link>
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

          {/* Quick pass block */}
          <div className="mt-8">
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-950 px-3 text-slate-500 font-mono tracking-wider">Demo Accounts Quick Pass</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {DEMO_USERS.map(demo => (
                <motion.button 
                  key={demo.id}
                  type="button"
                  onClick={() => handleDemoSignIn(demo.email, demo.role)}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-between p-3 rounded-xl border border-white/5 hover:border-white/10 bg-white/3 hover:bg-white/5 transition-all text-center cursor-pointer"
                >
                  <span className="text-xs font-semibold text-white truncate max-w-full">{demo.name}</span>
                  <span className={`mt-1.5 px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider uppercase ${
                    demo.role === 'client' 
                      ? 'bg-electric/10 text-electric border border-electric/20' 
                      : demo.role === 'freelancer'
                        ? 'bg-mint/10 text-mint border border-mint/20'
                        : 'bg-rose/10 text-rose border border-rose/20'
                  }`}>
                    {demo.role}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: ILLUSTRATION & FEATURES */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/5 rounded-2xl relative overflow-hidden flex-col justify-between p-10 text-white">
          <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-electric/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-15%] left-[-15%] w-80 h-80 bg-mint/3 rounded-full blur-3xl pointer-events-none" />
          
          <div className="h-6" />

          {/* Core Match Visual Mockup Card */}
          <div className="relative z-10 w-full max-w-sm mx-auto glass-card border border-white/10 bg-slate-900/70 p-6 rounded-2xl shadow-xl flex flex-col gap-4 select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-mint/15 border border-mint/25 flex items-center justify-center text-mint font-bold text-sm">
                  AR
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ali Raza</h4>
                  <p className="text-[10px] text-slate-400">Full Stack Developer</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-mint">$75/hr</span>
                <span className="text-[9px] text-slate-500">Declared rate</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
              {['React', 'Node.js', 'FastAPI', 'PostgreSQL'].map(s => (
                <span key={s} className="bg-slate-950/60 text-slate-400 text-[9px] px-2 py-0.5 rounded border border-white/3">{s}</span>
              ))}
            </div>

            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-lg border border-white/3 mt-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-mint" />
                <span className="text-[10px] text-slate-300 font-medium">Reputation Verified</span>
              </div>
              <span className="text-[10px] text-mint font-mono font-semibold bg-mint/10 border border-mint/20 px-2 py-0.5 rounded">0.05 Fraud</span>
            </div>
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
