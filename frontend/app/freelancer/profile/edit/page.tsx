'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { api, FreelancerRecord } from '@/lib/api'
import { ShieldCheck, Plus, Trash2, CheckCircle2, Award, Globe, Heart, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function EditProfilePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [experienceYears, setExperienceYears] = useState<number>(0)
  const [rating, setRating] = useState<number>(5.0)
  const [reviewCount, setReviewCount] = useState<number>(0)
  const [accountAgeDays, setAccountAgeDays] = useState<number>(30)
  const [availability, setAvailability] = useState(true)
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [currentScore, setCurrentScore] = useState<number>(0)

  // Skill ontology options
  const [allSkills, setAllSkills] = useState<string[]>([])
  const [skillQuery, setSkillQuery] = useState('')
  const [customSkillInput, setCustomSkillInput] = useState('')

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const [fl, sList] = await Promise.all([
          api.freelancers.get(flId),
          api.freelancers.skills()
        ])

        if (!active) return

        setName(fl.name || '')
        setSkills(fl.skills || [])
        setHourlyRate(fl.hourly_rate || 0)
        setExperienceYears(fl.experience_years || 0)
        setRating(fl.rating || 0)
        setReviewCount(fl.review_count || 0)
        setAccountAgeDays(fl.account_age_days || 0)
        setAvailability(fl.availability !== false)
        setPortfolioUrls(fl.portfolio_urls || [])
        setBio(fl.bio || '')
        setLocation(fl.location || '')
        setCurrentScore(fl.fraud_score || 0)
        setAllSkills(sList.skills || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load profile:', err)
        if (active) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [flId])

  const addUrl = () => {
    setPortfolioUrls(prev => [...prev, ''])
  }

  const removeUrl = (idxToRemove: number) => {
    setPortfolioUrls(prev => prev.filter((_, idx) => idx !== idxToRemove))
  }

  const handleUrlChange = (val: string, idxToChange: number) => {
    setPortfolioUrls(prev => prev.map((url, idx) => idx === idxToChange ? val : url))
  }

  const toggleSkill = (skill: string) => {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const addCustomSkill = () => {
    const t = customSkillInput.trim()
    if (t && !skills.includes(t)) setSkills(prev => [...prev, t])
    setCustomSkillInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)

    const payload = {
      name,
      skills,
      hourly_rate: Number(hourlyRate),
      experience_years: Number(experienceYears),
      rating: Number(rating),
      review_count: Number(reviewCount),
      account_age_days: Number(accountAgeDays),
      availability,
      portfolio_urls: portfolioUrls.filter(url => url.trim() !== ''),
      bio,
      location
    }

    try {
      await api.freelancers.update(flId, payload)
      setSaving(false)
      setSuccess(true)
      
      // Auto redirect to trust score after 1.5s
      setTimeout(() => {
        router.push('/freelancer/trust-score')
      }, 1500)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaving(false)
    }
  }

  const filteredSkills = allSkills.filter(s => 
    s.toLowerCase().includes(skillQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-mint border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Assembling details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="h-5.5 w-5.5 text-mint" /> Declare Professional Identity
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Declarative profile changes emit background audit events which will trigger Naive Bayes evaluation updates.
          </p>
        </div>
      </div>

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>Profile updated successfully! Emitting background fraud checks. Redirecting to Trust Score...</p>
        </motion.div>
      )}

      {/* Main Glass Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Col 1: Basic Identity & Parameters */}
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              Identity Declarations
            </h3>

            <div>
              <label className="input-label">FullName</label>
              <input 
                type="text" 
                required
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="input" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Hourly Rate ($/hr)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={hourlyRate} 
                  onChange={e => setHourlyRate(Number(e.target.value))} 
                  className="input font-mono" 
                />
              </div>
              <div>
                <label className="input-label">Years of Experience</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={experienceYears} 
                  onChange={e => setExperienceYears(Number(e.target.value))} 
                  className="input font-mono" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Rating Value (0-5)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="5"
                  required
                  value={rating} 
                  onChange={e => setRating(Number(e.target.value))} 
                  className="input font-mono" 
                />
              </div>
              <div>
                <label className="input-label">Review Count</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={reviewCount} 
                  onChange={e => setReviewCount(Number(e.target.value))} 
                  className="input font-mono" 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="input-label mb-0">Account Age (Days)</label>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  currentScore > 0.65 ? 'bg-rose-500/10 text-rose-400' : currentScore > 0.35 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  Current Fraud: {Math.round(currentScore * 100)}%
                </span>
              </div>
              <input 
                type="number" 
                required
                min="0"
                value={accountAgeDays} 
                onChange={e => setAccountAgeDays(Number(e.target.value))} 
                className="input font-mono" 
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Higher value = older account = lower fraud risk score.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox"
                id="availabilityCheck"
                checked={availability}
                onChange={e => setAvailability(e.target.checked)}
                className="rounded bg-slate-900 border-white/5 text-mint focus:ring-0 cursor-pointer h-4 w-4"
              />
              <label htmlFor="availabilityCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">Open for immediate hiring contract allocation</label>
            </div>

            <div>
              <label className="input-label">Location</label>
              <input 
                type="text" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                placeholder="e.g. London, UK"
                className="input" 
              />
            </div>
          </div>

          {/* Col 2: Skills & External URLs */}
          <div className="space-y-8">
            {/* Bio & Skills */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
                Bio & Skills Matrix
              </h3>
              
              <div>
                <label className="input-label">Brief Professional Biography</label>
                <textarea 
                  rows={4}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Introduce yourself to prospective clients..."
                  className="input resize-none text-xs"
                />
              </div>

              <div>
                <label className="input-label">Skill Capabilities</label>

                {/* Custom skill input */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Type a custom skill and press Enter..."
                    value={customSkillInput}
                    onChange={e => setCustomSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
                    className="input text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    disabled={!customSkillInput.trim()}
                    className="btn btn-sm btn-ghost px-3 border border-mint/20 text-mint hover:bg-mint/10 disabled:opacity-30 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Selected skill chips */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {skills.map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-mint/15 text-white border border-mint/30">
                        {skill}
                        <button
                          type="button"
                          onClick={() => setSkills(prev => prev.filter(s => s !== skill))}
                          className="text-mint/70 hover:text-white ml-0.5 transition-colors cursor-pointer leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Filter predefined skills */}
                <input
                  type="text"
                  placeholder="Search predefined skills..."
                  value={skillQuery}
                  onChange={e => setSkillQuery(e.target.value)}
                  className="input mb-2 text-xs"
                />
                <div className="max-h-[100px] overflow-y-auto bg-slate-950/40 p-2.5 border border-white/5 rounded-lg flex flex-wrap gap-1 min-h-[40px]">
                  {filteredSkills.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic self-center w-full text-center">
                      {allSkills.length === 0 ? 'Loading predefined skills...' : 'No skills match your search'}
                    </p>
                  ) : filteredSkills.map(skill => {
                    const active = skills.includes(skill)
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          active
                            ? 'bg-mint/15 text-white border border-mint/30'
                            : 'bg-slate-900/60 text-slate-400 border border-white/5'
                        }`}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Dynamic URLs */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-4.5 w-4.5 text-indigo-400" /> Portfolio Links
                </h3>
                <button
                  type="button"
                  onClick={addUrl}
                  className="btn btn-sm btn-ghost inline-flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add URL
                </button>
              </div>

              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {portfolioUrls.map((url, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2"
                    >
                      <input 
                        type="url"
                        placeholder="https://github.com/yourprofile"
                        value={url}
                        onChange={e => handleUrlChange(e.target.value, idx)}
                        className="input text-xs flex-1"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeUrl(idx)}
                        className="btn btn-sm btn-danger p-2.5 rounded-lg shrink-0 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {portfolioUrls.length === 0 && (
                  <p className="text-slate-500 text-xs italic py-4 text-center">
                    No external portfolio web links added. (Low links increase fraud risk rating).
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit controls */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-md btn-primary px-8 flex items-center gap-2 bg-mint hover:bg-emerald-400 border-none text-ink font-semibold shadow-lg shadow-mint/20 cursor-pointer"
          >
            <Save className="h-4.5 w-4.5" />
            {saving ? 'Saving changes...' : 'Save Profile declarations'}
          </button>
        </div>
      </form>
    </div>
  )
}
