'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, ShieldAlert, CheckCircle, Briefcase, ChevronRight } from 'lucide-react'
import { FreelancerRecord } from '@/lib/api'
import { SkillBadge } from './SkillBadge'
import { HireModal } from './HireModal'
import { fraudColor, fraudLabel } from '@/lib/utils'

interface Props {
  freelancer: FreelancerRecord & { match_score?: number; rank_score?: number }
  role: 'client' | 'admin' | 'freelancer'
  showHireAction?: boolean
  onHireSuccess?: () => void
}

export function FreelancerCard({ freelancer, role, showHireAction = false, onHireSuccess }: Props) {
  const [showHireModal, setShowHireModal] = useState(false)

  const fColor = fraudColor(freelancer.fraud_score)
  const fText = fraudLabel(freelancer.fraud_score)

  const badgeColors: Record<string, string> = {
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    mint: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  }

  return (
    <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden group">
      {/* Background glow hover effect */}
      <div className="absolute inset-0 bg-linear-to-b from-indigo-500/0 to-indigo-500/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div>
        {/* Header Name & Fraud Badge */}
        <div className="flex justify-between items-start gap-4 mb-3">
          <div>
            <h4 className="text-base font-bold text-white tracking-tight">{freelancer.name}</h4>
            <p className="text-xs text-slate-500 mt-0.5">Exp: {freelancer.experience_years} years · Rating: {freelancer.rating ? freelancer.rating.toFixed(1) : '0.0'}</p>
          </div>
          
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border uppercase ${badgeColors[fColor]}`}>
            {freelancer.fraud_score > 0.35 ? <ShieldAlert className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
            {fText}
          </span>
        </div>

        {/* Rating and rate */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center text-amber-400">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs font-semibold ml-1">{freelancer.rating ? freelancer.rating.toFixed(1) : '0.0'}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">({freelancer.review_count} reviews)</span>
          </div>
          <span className="text-sm font-bold text-white">${freelancer.hourly_rate}/hr</span>
        </div>

        {/* AI matching score indicator if available */}
        {freelancer.match_score !== undefined && (
          <div className="mb-4 bg-slate-950/40 border border-white/5 rounded-lg p-2.5">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 font-medium">AI Match Score</span>
              <span className="text-emerald-400 font-semibold">{Math.round(freelancer.match_score * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.round(freelancer.match_score * 100)}%` }} 
              />
            </div>
          </div>
        )}

        {/* Skills List */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {(freelancer.skills || []).slice(0, 5).map(skill => (
            <SkillBadge key={skill} skill={skill} />
          ))}
          {freelancer.skills?.length > 5 && (
            <span className="text-[10px] text-slate-500 self-center px-1">+{freelancer.skills.length - 5} more</span>
          )}
        </div>
      </div>

      {/* Action triggers */}
      <div className="flex gap-2 items-center border-t border-white/3 pt-4 mt-auto">
        <Link 
          href={role === 'client' ? `/client/freelancers/${freelancer.id}` : `/freelancer/dashboard`}
          className="flex-1 btn btn-sm btn-ghost flex items-center justify-center gap-1.5 py-2 cursor-pointer"
        >
          View Profile <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {showHireAction && role === 'client' && (
          <button 
            onClick={() => setShowHireModal(true)}
            className="flex-1 btn btn-sm btn-primary py-2 cursor-pointer"
          >
            Hire
          </button>
        )}
      </div>

      {showHireModal && (
        <HireModal 
          freelancerId={freelancer.id}
          onSuccess={() => {
            setShowHireModal(false)
            if (onHireSuccess) onHireSuccess()
          }}
          onClose={() => setShowHireModal(false)}
        />
      )}
    </div>
  )
}
