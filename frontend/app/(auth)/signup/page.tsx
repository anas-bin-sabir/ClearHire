'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight, Lock, Mail, User, AlertCircle, CheckCircle2, Eye, EyeOff, UserCheck, Briefcase } from 'lucide-react'
import { motion } from 'framer-motion'
import ThemeToggle from '@/components/ThemeToggle'

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
      setError('You must agree to the Terms & Conditions.')
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

      setSuccess('Account registered successfully! Redirecting to login page...')
      
      // Clear form
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.5, 
        ease: [0.16, 1, 0.3, 1] as any,
        staggerChildren: 0.08
      } 
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring' as any, stiffness: 100, damping: 15 }
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
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl overflow-hidden glass-card flex flex-col md:flex-row p-3 gap-3 relative z-10 border border-white/5 shadow-2xl"
      >
        {/* LEFT PANEL: ILLUSTRATION & FEATURES */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/5 rounded-2xl relative overflow-hidden flex-col justify-between p-10 text-white">
          <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-electric/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-15%] right-[-15%] w-80 h-80 bg-mint/3 rounded-full blur-3xl pointer-events-none" />
          
          <div className="h-4" />

          {/* Profile Image */}
          <div className="relative z-10 flex items-center justify-center select-none">
            <img
              src="/boy-img.png"
              alt="Client Profile"
              className="w-full max-w-75 object-contain drop-shadow-2xl"
            />
          </div>

          {/* Features Description */}
          <div className="w-full max-w-md space-y-3 mt-6 relative z-10 select-none text-left">
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl text-[11px] font-medium leading-relaxed border border-white/5 shadow-sm text-slate-300 flex items-start gap-2.5">
              <span className="text-electric text-sm shrink-0">✦</span>
              <span><strong>AI-Driven Skill Match:</strong> Instantly matches project scopes with verified freelancer portfolios and location parameters.</span>
            </div>

            <div className="bg-white/3 backdrop-blur-md p-4 rounded-2xl text-[11px] font-medium leading-relaxed border border-white/5 shadow-sm text-slate-300 flex items-start gap-2.5">
              <span className="text-mint text-sm shrink-0">✦</span>
              <span><strong>Bayesian Trust Audit:</strong> Analyzes behavior anomalies and profile signals to compute real-time fraud risk scores.</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: SIGNUP FORM */}
        <div className="flex-1 px-6 py-8 md:px-10 md:py-8 flex flex-col justify-between">
          <motion.div variants={itemVariants}>
            {/* Logo */}
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

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">Create Account</h2>
            <p className="text-xs text-slate-400 mb-6">Select your platform role and establish your secure credentials.</p>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded-lg bg-rose/10 border border-rose/20 text-rose text-xs flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 animate-pulse" />
                <p>{success}</p>
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role selector */}
              <div>
                <label className="input-label text-xs">Register As</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setRole('client')}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
                      role === 'client'
                        ? 'bg-electric/15 text-white border-electric shadow-lg shadow-electric/10'
                        : 'bg-white/3 text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <UserCheck className="h-4.5 w-4.5" />
                    Client Hub
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('freelancer')}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
                      role === 'freelancer'
                        ? 'bg-mint/15 text-white border-mint shadow-lg shadow-mint/10'
                        : 'bg-white/3 text-slate-400 border-white/5 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Briefcase className="h-4.5 w-4.5" />
                    Freelancer
                  </button>
                </div>
              </div>

              {/* Grid 1: Name and Email side-by-side to fit on screen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-xs">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input 
                      type="text"
                      required
                      placeholder="Sara Ahmed"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="input input-with-icon w-full"
                    />
                  </div>
                </div>

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
              </div>

              {/* Grid 2: Password and Confirm Password side-by-side to fit on screen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-xs">Password</label>
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

                <div>
                  <label className="input-label text-xs">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="input input-with-icon w-full"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center text-[11px] font-semibold text-slate-400 cursor-pointer select-none py-0.5">
                <input 
                  type="checkbox" 
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                  className="mr-2 rounded bg-slate-900 border-white/5 text-electric focus:ring-0 h-4 w-4 cursor-pointer" 
                  required 
                />
                <span>I agree to the Terms &amp; Conditions and privacy policy</span>
              </label>

              <motion.button 
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className={`w-full btn btn-md mt-2 transition-all duration-300 font-semibold cursor-pointer ${
                  role === 'client' 
                    ? 'btn-primary' 
                    : 'bg-mint hover:bg-emerald-400 border-none text-ink shadow-lg shadow-mint/20 hover:shadow-emerald-400/25'
                }`}
              >
                {loading ? 'Creating Account…' : `Sign Up as ${role === 'client' ? 'Client' : 'Freelancer'}`}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </motion.button>
            </form>
          </motion.div>

          <div className="text-center mt-4 text-xs text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-electric font-bold hover:underline ml-1">
              Log In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
