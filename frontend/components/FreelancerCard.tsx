"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Star, MapPin, Clock, DollarSign, Shield, UserCircle, Users } from "lucide-react";

interface Freelancer {
  id: number;
  name: string;
  avatar: string;
  location?: string;
  skills: string[];
  rating: number;
  hourly_rate: number;
  experience_years: number;
  availability: boolean;
  fraud_score: number;
  match_score: number;
  [key: string]: unknown;
}

function FraudBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const [colorVar, rgbVar, label] =
    pct < 25 ? ["var(--color-success)", "var(--color-success-rgb)", "Low Risk"] :
    pct < 55 ? ["var(--color-warning)", "var(--color-warning-rgb)", "Medium"]   :
               ["var(--color-danger)",  "var(--color-danger-rgb)",  "High Risk"];
  const circ = 2 * Math.PI * 10;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      style={{ background: `rgba(${rgbVar}, 0.1)` }}>
      <svg width="18" height="18" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
        <circle cx="14" cy="14" r="10" fill="none" stroke={`rgba(var(--border-base), 0.08)`} strokeWidth="4" />
        <circle cx="14" cy="14" r="10" fill="none" stroke={colorVar}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: colorVar }}>
        {label}
      </span>
    </div>
  );
}

interface FreelancerCardProps {
  freelancer: Freelancer;
  index?: number;
  onViewProfile?: (freelancer: Freelancer) => void;
  onAddToTeam?: (freelancer: Freelancer) => void;
}

export default React.memo(function FreelancerCard({
  freelancer, index = 0, onViewProfile, onAddToTeam,
}: FreelancerCardProps) {
  const shouldSkip = useReducedMotion();
  const { name, avatar, location, skills, rating, hourly_rate, experience_years, availability, fraud_score, match_score } = freelancer;

  const scoreColor =
    match_score >= 90 ? "var(--color-primary)" :
    match_score >= 70 ? "var(--color-primary)" :
                        "var(--color-warning)";

  return (
    <motion.div
      initial={shouldSkip ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={shouldSkip ? undefined : { y: -2, transition: { duration: 0.15 } }}
      className="rounded-xl p-5 flex flex-col gap-4 transition-all duration-200 relative overflow-hidden"
      style={{ background: "var(--card)" }}
    >
      {/* Match score corner badge */}
      <div className="absolute top-3 right-3">
        <span className="text-[11px] font-mono font-bold" style={{ color: scoreColor }}>
          {match_score}%
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 pr-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-mono font-bold flex-shrink-0"
          style={{ background: `rgba(var(--color-primary-rgb), 0.12)`, color: "var(--text-primary)" }}>
          {avatar}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate leading-tight" style={{ color: "var(--text-primary)" }}>
            {name}
          </h3>
          {location && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
              <MapPin size={9} /> {location}
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
        <span className="flex items-center gap-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" />
          {Number(rating).toFixed(1)}
        </span>
        <span className="flex items-center gap-1"><DollarSign size={10} />${hourly_rate}/hr</span>
        <span className="flex items-center gap-1"><Clock size={10} />{experience_years}y exp</span>
        <span
          className="ml-auto px-2 py-0.5 rounded-md"
          style={{
            background: availability ? `rgba(var(--color-success-rgb), 0.1)` : `rgba(var(--border-base), 0.04)`,
            color: availability ? "var(--color-success)" : "var(--text-subtle)",
          }}
        >
          {availability ? "Available" : "Busy"}
        </span>
      </div>

      {/* Skill chips */}
      <div className="flex flex-wrap gap-1.5">
        {skills.slice(0, 4).map((s) => (
          <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-mono"
            style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, color: "var(--color-primary)" }}>
            {s}
          </span>
        ))}
        {skills.length > 4 && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
            +{skills.length - 4}
          </span>
        )}
      </div>

      {/* Match score bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider"
          style={{ color: "var(--text-subtle)" }}>
          <span>Match</span>
          <span style={{ color: scoreColor }}>{match_score}%</span>
        </div>
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.08)` }}>
          <motion.div
            initial={shouldSkip ? false : { width: 0 }}
            animate={{ width: `${match_score}%` }}
            transition={{ delay: index * 0.04 + 0.25, duration: 0.7, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "var(--color-primary)" }}
          />
        </div>
      </div>

      {/* Fraud */}
      <div className="flex items-center gap-2">
        <Shield size={11} style={{ color: "var(--text-subtle)" }} />
        <FraudBadge score={fraud_score} />
        <span className="text-[9px] font-mono ml-1" style={{ color: "var(--text-subtle)" }}>
          trust {Math.round((1 - fraud_score) * 100)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onViewProfile?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, color: "var(--color-primary)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.15)`)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.08)`)}
        >
          <span className="flex items-center justify-center gap-1.5"><UserCircle size={13} /> Profile</span>
        </button>
        <button
          onClick={() => onAddToTeam?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, color: "var(--color-primary)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.15)`)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.08)`)}
        >
          <span className="flex items-center justify-center gap-1.5"><Users size={13} /> Add</span>
        </button>
      </div>
    </motion.div>
  );
});
