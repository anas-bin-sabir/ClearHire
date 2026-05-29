"use client";
import { motion } from "motion/react";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";

function FraudBadge({ score }) {
  const pct = Math.round(score * 100);
  const cfg =
    pct < 25
      ? {
          label: "Low Risk",
          color: "#10B981",
          bg: "rgba(16,185,129,0.1)",
          border: "rgba(16,185,129,0.25)",
        }
      : pct < 55
        ? {
            label: "Medium",
            color: "#F59E0B",
            bg: "rgba(245,158,11,0.1)",
            border: "rgba(245,158,11,0.25)",
          }
        : {
            label: "High Risk",
            color: "#EF4444",
            bg: "rgba(239,68,68,0.1)",
            border: "rgba(239,68,68,0.25)",
          };

  const circumference = 2 * Math.PI * 10;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <svg width="18" height="18" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
        <circle
          cx="14"
          cy="14"
          r="10"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="4"
        />
        <circle
          cx="14"
          cy="14"
          r="10"
          fill="none"
          stroke={cfg.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span
        className="text-[10px] font-mono whitespace-nowrap"
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

export default function FreelancerCard({
  freelancer,
  index = 0,
  onViewProfile,
  onAddToTeam,
}) {
  const {
    name,
    avatar,
    location,
    skills,
    rating,
    hourly_rate,
    experience_years,
    availability,
    fraud_score,
    match_score,
  } = freelancer;

  const matchColor =
    match_score >= 85
      ? "from-cyan-400 to-cyan-300"
      : match_score >= 65
        ? "from-violet-400 to-violet-300"
        : "from-slate-500 to-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      style={{
        background: "rgba(17,24,39,0.85)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      className="rounded-2xl p-5 flex flex-col gap-4 group hover:border-cyan-500/20 transition-all duration-200 relative overflow-hidden"
    >
      {/* Match score — top right corner arc */}
      <div className="absolute top-0 right-0">
        <div
          className={`w-16 h-16 flex items-end justify-start p-2 rounded-bl-3xl`}
          style={{
            background: `linear-gradient(135deg, transparent 50%, rgba(0,212,255,0.06) 50%)`,
          }}
        >
          <span
            className={`text-[11px] font-mono font-bold bg-gradient-to-r ${matchColor} bg-clip-text text-transparent`}
          >
            {match_score}%
          </span>
        </div>
      </div>

      {/* Header: avatar + name */}
      <div className="flex items-start gap-3 pr-14">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-mono font-bold text-white flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {avatar}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm truncate leading-tight">
            {name}
          </h3>
          {location && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 font-mono">
              <MapPin size={9} /> {location}
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" />{" "}
          {Number(rating).toFixed(1)}
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
            background: availability
              ? "rgba(16,185,129,0.1)"
              : "rgba(255,255,255,0.04)",
            color: availability ? "#10B981" : "#64748B",
            border: `1px solid ${availability ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          {availability ? "Available" : "Unavailable"}
        </span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5">
        {skills.slice(0, 4).map((s) => (
          <span
            key={s}
            className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {s}
          </span>
        ))}
        {skills.length > 4 && (
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            +{skills.length - 4}
          </span>
        )}
      </div>

      {/* Match bar + fraud */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-600 uppercase tracking-wider">
          <span>Match Score</span>
          <span>{match_score}%</span>
        </div>
        <div
          className="h-1 w-full rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${match_score}%` }}
            transition={{
              delay: index * 0.05 + 0.3,
              duration: 0.7,
              ease: "easeOut",
            }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #00D4FF, #7C3AED)" }}
          />
        </div>
      </div>

      {/* Fraud + Trust */}
      <div className="flex items-center gap-2">
        <Shield size={12} className="text-slate-600" />
        <FraudBadge score={fraud_score} />
        <span className="text-[9px] font-mono text-slate-600 ml-1">
          trust score: {Math.round((1 - fraud_score) * 100)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onViewProfile?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-all"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "#00D4FF",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0,212,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0,212,255,0.08)";
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <UserCircle size={13} /> Profile
          </span>
        </button>
        <button
          onClick={() => onAddToTeam?.(freelancer)}
          className="flex-1 py-2 rounded-xl text-[11px] font-mono font-semibold uppercase tracking-wider transition-all"
          style={{
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.2)",
            color: "#A78BFA",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.08)";
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users size={13} /> Add
          </span>
        </button>
      </div>
    </motion.div>
  );
}
