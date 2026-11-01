'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, LoadingRows, Notice, Spinner } from '@/components/ui/States'
import { fraudLabel, fraudTone } from '@/lib/utils'

export default function EditProfilePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

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
        if (active) {
          setLoadFailed(true)
          setLoading(false)
        }
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
    setSaveError(null)

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
      setSaveError('Your changes weren’t saved. Check the fields and try again.')
      setSaving(false)
    }
  }

  const filteredSkills = allSkills.filter(s => 
    s.toLowerCase().includes(skillQuery.toLowerCase())
  )

  const section = 'grid grid-cols-1 gap-x-10 gap-y-5 border-b border-line py-8 lg:grid-cols-[16rem_minmax(0,1fr)]'

  if (loading) {
    return (
      <>
        <PageHeader title="Profile" />
        <div className="p-5 sm:p-8"><LoadingRows rows={4} label="Loading your profile" /></div>
      </>
    )
  }

  if (loadFailed) {
    return (
      <>
        <PageHeader title="Profile" />
        <div className="p-5 sm:p-8"><ErrorState message="Your profile couldn’t be loaded. Refresh the page to try again." /></div>
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title="Profile"
        description="This is what clients and the matching engine see. Saving re-runs your trust analysis."
        actions={<Badge tone={fraudTone(currentScore)}>Trust: {fraudLabel(currentScore).toLowerCase()}, {Math.round(currentScore * 100)}% risk</Badge>}
      />

      <div className="px-5 sm:px-8">
        <section className={section} aria-labelledby="sec-about">
          <div>
            <h2 id="sec-about" className="text-[15px] font-semibold text-fg">About you</h2>
            <p className="mt-1 text-[13px] text-fg-2">Your name and a short bio appear at the top of your profile.</p>
          </div>
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-name" className="field-label">Full name</label>
              <input id="pf-name" type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="input" />
            </div>
            <div>
              <label htmlFor="pf-location" className="field-label">Location</label>
              <input id="pf-location" type="text" placeholder="City, country" value={location} onChange={e => setLocation(e.target.value)} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pf-bio" className="field-label">Bio</label>
              <textarea id="pf-bio" rows={4} placeholder="What you build and the kind of work you take on" value={bio} onChange={e => setBio(e.target.value)} className="input" />
            </div>
          </div>
        </section>

        <section className={section} aria-labelledby="sec-work">
          <div>
            <h2 id="sec-work" className="text-[15px] font-semibold text-fg">Rate and availability</h2>
            <p className="mt-1 text-[13px] text-fg-2">Used to fit you into project budgets.</p>
          </div>
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-rate" className="field-label">Hourly rate (USD)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-2">$</span>
                <input id="pf-rate" type="number" min="0" required value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} className="input pl-6 tabular-nums" />
              </div>
            </div>
            <div>
              <label htmlFor="pf-exp" className="field-label">Years of experience</label>
              <input id="pf-exp" type="number" min="0" required value={experienceYears} onChange={e => setExperienceYears(Number(e.target.value))} className="input tabular-nums" />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-fg sm:col-span-2">
              <input type="checkbox" checked={availability} onChange={e => setAvailability(e.target.checked)} className="h-4 w-4" />
              Available for new contracts
            </label>
          </div>
        </section>

        <section className={section} aria-labelledby="sec-skills">
          <div>
            <h2 id="sec-skills" className="text-[15px] font-semibold text-fg">Skills</h2>
            <p className="mt-1 text-[13px] text-fg-2">Matching compares these against each project’s requirements.</p>
          </div>
          <div className="max-w-2xl space-y-3">
            {skills.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Your skills">
                {skills.map(skill => (
                  <li key={skill}>
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-chip bg-shell pl-2.5 pr-1 text-[13px] font-medium text-on-dark">
                      {skill}
                      <button type="button" onClick={() => toggleSkill(skill)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-shell-3" aria-label={`Remove ${skill}`}>
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-warn">Add at least one skill so you can be matched.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-skill-filter" className="sr-only">Filter skills</label>
                <input id="pf-skill-filter" type="text" placeholder="Filter the skill list" value={skillQuery} onChange={e => setSkillQuery(e.target.value)} className="input" />
              </div>
              <div className="flex gap-2">
                <label htmlFor="pf-custom-skill" className="sr-only">Add a skill that isn’t listed</label>
                <input
                  id="pf-custom-skill"
                  type="text"
                  placeholder="Add a skill that isn’t listed"
                  value={customSkillInput}
                  onChange={e => setCustomSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
                  className="input"
                />
                <button type="button" onClick={addCustomSkill} disabled={!customSkillInput.trim()} className="btn btn-icon btn-secondary shrink-0" aria-label="Add skill">
                  <Plus aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-field border border-line bg-sunken p-2">
              {filteredSkills.length === 0 ? (
                <p className="p-1 text-[13px] text-fg-2">No listed skill matches. Add it as your own.</p>
              ) : filteredSkills.map(skill => {
                const active = skills.includes(skill)
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={active}
                    className={`min-h-8 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                      active ? 'border-shell bg-shell text-on-dark' : 'border-line bg-panel text-fg-2 hover:text-fg'
                    }`}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className={section} aria-labelledby="sec-portfolio">
          <div>
            <h2 id="sec-portfolio" className="text-[15px] font-semibold text-fg">Portfolio</h2>
            <p className="mt-1 text-[13px] text-fg-2">Links to work you’ve shipped. Clients see these on your profile.</p>
          </div>
          <div className="max-w-2xl space-y-2">
            {portfolioUrls.length === 0 && <p className="text-[13px] text-fg-2">No links yet.</p>}
            {portfolioUrls.map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <label htmlFor={`pf-url-${idx}`} className="sr-only">Portfolio link {idx + 1}</label>
                <input
                  id={`pf-url-${idx}`}
                  type="url"
                  placeholder="https://"
                  value={url}
                  onChange={e => handleUrlChange(e.target.value, idx)}
                  className="input"
                />
                <button type="button" onClick={() => removeUrl(idx)} className="btn btn-icon btn-ghost shrink-0 hover:text-danger" aria-label={`Remove link ${idx + 1}`}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" onClick={addUrl} className="btn btn-sm btn-secondary">
              <Plus aria-hidden /> Add a link
            </button>
          </div>
        </section>

        <section className={section} aria-labelledby="sec-record">
          <div>
            <h2 id="sec-record" className="text-[15px] font-semibold text-fg">Platform record</h2>
            <p className="mt-1 text-[13px] text-fg-2">These feed the trust model. Keep them accurate.</p>
          </div>
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pf-rating" className="field-label">Rating (0–5)</label>
              <input id="pf-rating" type="number" step="0.1" min="0" max="5" value={rating} onChange={e => setRating(Number(e.target.value))} className="input tabular-nums" />
            </div>
            <div>
              <label htmlFor="pf-reviews" className="field-label">Reviews</label>
              <input id="pf-reviews" type="number" min="0" value={reviewCount} onChange={e => setReviewCount(Number(e.target.value))} className="input tabular-nums" />
            </div>
            <div>
              <label htmlFor="pf-age" className="field-label">Account age (days)</label>
              <input id="pf-age" type="number" min="0" value={accountAgeDays} onChange={e => setAccountAgeDays(Number(e.target.value))} className="input tabular-nums" />
            </div>
          </div>
        </section>
      </div>

      {/* Save bar stays in reach on long forms */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-line bg-panel px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-h-5" aria-live="polite">
          {success && <Notice tone="ok">Profile saved. Opening your updated trust score…</Notice>}
          {saveError && <Notice tone="danger">{saveError}</Notice>}
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary shrink-0">
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
