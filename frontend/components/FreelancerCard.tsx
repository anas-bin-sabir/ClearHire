"use client";
import { motion } from "motion/react";
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
  [key: string]: any;
}

interface FraudBadgeProps {
  score: number;
}

function FraudBadge({ score }: FraudBadgeProps) {
  const pct = Math.round(score * 100);
  const colorVar =
    pct < 25 ? "var(--color-success)" : pct < 55 ? "var(--color-warning)" : "var(--color-danger)";
  const rgbVar =
    pct < 25 ? "var(--color-success-rgb)" : pct < 55 ? "var(--color-warning-rgb)" : "var(--color-danger-rgb)";
  const label = pct < 25 ? "Low Risk" : pct < 55 ? "Medium" : "High Risk";

  const circumference = 2 * Math.PI * 10;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      style={{
        background: `rgba(${rgbVar}, 0.1)`,
        border: `1px solid rgba(${rgbVar}, 0.25)`,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
        <circle cx="14" cy="14" r="10" fill="none" stroke={`rgba(var(--border-base), 0.06)`} strokeWidth="4" />
        <circle
          cx="14" cy="14" r="10" fill="none" stroke={colorVar}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
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

export default function FreelancerCard({
  freelancer,
  index = 0,
  onViewProfile,
  onAddToTeam,
}: FreelancerCardProps) {
  const { name, avatar, location, skills, rating, hourly_rate, experience_years, availability, fraud_score, match_score } = freelancer;

  const matchColor =
    match_score >= 85
      ? "from-primary to-primary/70"
      : match_score >= 65
        ? "from-secondary to-secondary/70"
        : "from-slate-500 to-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="rounded-2xl p-5 flex flex-col gap-4 group transition-all duration-200 relative overflow-hidden"
      style={{
        background: `rgba(var(--bg-secondary-rgb), 0.85)`,
        border: `1px solid rgba(var(--border-base), 0.06)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `rgba(var(--color-primary-rgb), 0.2)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `rgba(var(--border-base), 0.06)`;
      }}
    >
      {/* Match score corner */}
      <div className="absolute top-0 right-0">
        <div
          className="w-16 h-16 flex items-end justify-start p-2 rounded-bl-3xl"
          style={{ background: `linear-gradient(135deg, transparent 50%, rgba(var(--color-primary-rgb), 0.06) 50%)` }}
        >
          <span className={`text-[11px] font-mono font-bold bg-gradient-to-r ${matchColor} bg-clip-text text-transparent`}>
            {match_score}%
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 pr-14">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-mono font-bold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.2), rgba(var(--color-secondary-rgb),0.2))`,
            border: `1px solid rgba(var(--border-base), 0.1)`,
            color: "var(--text-primary)",
          }}
        >
          {avatar}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate leading-tight" style={{ color: "var(--text-primary)" }}>
            {name}
          </h3>
          {location && (
            <div
              className="flex items-center gap-1 mt-0.5 text-[10px] font-mono"
              style={{ color: "var(--text-subtle)" }}
            >
              <MapPin size={9} /> {location}
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
        <span className="flex items-center gap-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" /> {Number(rating).toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign size={10} /> ${hourly_rate}/hr
        </span>
        <span className="flex items-center gap-1">
          <Clock size={10} /> {experience_years}y
        </span>
        <span
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md"
          style={{
            background: availability ? `rgba(var(--color-success-rgb), 0.1)` : `rgba(var(--border-base), 0.04)`,
            color: availability ? "var(--color-success)" : "var(--text-subtle)",
            border: `1px solid ${availability ? `rgba(var(--color-success-rgb), 0.2)` : `rgba(var(--border-base), 0.06)`}`,
          }}
        >
          {availability ? "Available" : "Unavailable"}
        </span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5">
        {skills.slice(0, 4).map((s: string) => (
          <span
            key={s}
            className="px-2 py-0.5 rounded-md text-[10px] font-mono"
            style={{
              background: `rgba(var(--border-base), 0.05)`,
              border: `1px solid rgba(var(--border-base), 0.08)`,
              color: "var(--text-secondary)",
            }}
          >
            {s}
          </span>
        ))}
        {skills.length > 4 && (
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-mono"
            style={{ background: `rgba(var(--border-base), 0.03)`, color: "var(--text-subtle)" }}
          >
            +{skills.length - 4}
          </span>
        )}
      </div>

      {/* Match bar */}
      <div className="space-y-2">
        <div
          className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider"
          style={{ color: "var(--text-subtle)" }}
        >
          <span>Match Score</span>
          <span>{match_score}%</span>
        </div>
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${match_score}%` }}
            transition={{ delay: index * 0.05 + 0.3, duration: 0.7, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }}
          />
        </div>
      </div>

      {/* Fraud */}
      <div className="flex items-center gap-2">
        <Shield size={12} style={{ color: "var(--text-subtle)" }} />
        <FraudBadge score={fraud_score} />
        <span className="text-[9px] font-mono ml-1" style={{ color: "var(--text-subtle)" }}>
          trust score: {Math.round((1 - fraud_score) * 100)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onViewProfile?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-all"
          style={{
            background: `rgba(var(--color-primary-rgb), 0.08)`,
            border: `1px solid rgba(var(--color-primary-rgb), 0.2)`,
            color: "var(--color-primary)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.15)`)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-primary-rgb), 0.08)`)}
        >
          <span className="flex items-center justify-center gap-1.5">
            <UserCircle size={13} /> Profile
          </span>
        </button>
        <button
          onClick={() => onAddToTeam?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-all"
          style={{
            background: `rgba(var(--color-secondary-rgb), 0.08)`,
            border: `1px solid rgba(var(--color-secondary-rgb), 0.2)`,
            color: "var(--color-secondary)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-secondary-rgb), 0.15)`)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--color-secondary-rgb), 0.08)`)}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users size={13} /> Add
          </span>
        </button>
      </div>
    </motion.div>
  );
}
