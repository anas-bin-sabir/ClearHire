"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  ShieldAlert,
  ArrowLeft,
  Users,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Calendar,
  TrendingUp,
  Zap,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FraudGauge from "@/components/FraudGauge";
import AIReasoningBox from "@/components/AIReasoningBox";
import { FREELANCERS } from "@/data/mockData";

const TABS = ["Overview", "Skills", "Work History", "Reviews", "Fraud Report"];

// ─── Skill graph adjacency (quoted keys avoid dot-in-identifier issues) ────────
const SKILL_ADJ = {
  Python: ["FastAPI", "Data Science", "ML", "Docker"],
  React: ["JavaScript", "UI/UX", "Node.js"],
  ML: ["Python", "Data Science"],
  DevOps: ["Docker", "PostgreSQL"],
  "Data Science": ["Python", "ML", "PostgreSQL"],
  JavaScript: ["React", "Node.js"],
  FastAPI: ["Python", "Node.js"],
  "UI/UX": ["Figma", "React"],
  "Node.js": ["JavaScript", "FastAPI", "PostgreSQL"],
  Docker: ["DevOps", "PostgreSQL"],
  PostgreSQL: ["Docker", "Node.js"],
  Figma: ["UI/UX"],
};

function inferSkills(skills) {
  const inferred = new Set();
  for (const s of skills) {
    for (const rel of SKILL_ADJ[s] ?? []) {
      if (!skills.includes(rel)) inferred.add(rel);
    }
  }
  return [...inferred];
}

// Deterministic "random" using index seed so it's stable between renders
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Availability grid (28 cells: 4 weeks × 7 days) ──────────────────────────
function AvailabilityGrid({ available, seed }) {
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const cells = Array.from({ length: 28 }, (_, i) => ({
    active: available
      ? seededRand(seed + i) > 0.25
      : seededRand(seed + i) > 0.75,
  }));

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {days.map((d) => (
          <div
            key={d}
            className="flex-1 text-center text-[9px] font-mono text-slate-600"
          >
            {d}
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((w) => (
        <div key={w} className="flex gap-1">
          {cells.slice(w * 7, w * 7 + 7).map((c, i) => (
            <div
              key={i}
              className="flex-1 h-6 rounded-md"
              style={{
                background: c.active
                  ? "rgba(0,212,255,0.18)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${c.active ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500 mt-1">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-2 rounded-sm inline-block"
            style={{
              background: "rgba(0,212,255,0.18)",
              border: "1px solid rgba(0,212,255,0.3)",
            }}
          />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-2 rounded-sm inline-block"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          Booked
        </span>
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ f }) {
  const stats = [
    {
      label: "Experience",
      value: `${f.experience_years}y`,
      icon: Briefcase,
      color: "#00D4FF",
    },
    {
      label: "Hourly Rate",
      value: `$${f.hourly_rate}`,
      icon: DollarSign,
      color: "#7C3AED",
    },
    { label: "Reviews", value: f.review_count, icon: Star, color: "#F59E0B" },
    {
      label: "Account Age",
      value: `${f.account_age_days}d`,
      icon: Calendar,
      color: "#10B981",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-4 rounded-2xl"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <s.icon size={16} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-mono font-bold text-white">
              {s.value}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
      <div
        className="p-5 rounded-2xl"
        style={{
          background: "rgba(17,24,39,0.7)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
          About
        </h4>
        <p className="text-slate-300 text-sm leading-relaxed">{f.bio}</p>
      </div>
      <div
        className="p-5 rounded-2xl"
        style={{
          background: "rgba(17,24,39,0.7)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
          Availability — Next 4 Weeks
        </h4>
        <AvailabilityGrid available={f.availability} seed={f.id * 17} />
      </div>
    </div>
  );
}

// ─── Skills Tab ───────────────────────────────────────────────────────────────
function SkillsTab({ f }) {
  const inferred = inferSkills(f.skills);
  const bars = f.skills.map((s, i) => ({
    name: s,
    level: 60 + Math.floor(seededRand(f.id * 31 + i) * 40),
    yrs: Math.max(
      1,
      Math.round(f.experience_years * (0.4 + seededRand(f.id + i * 7) * 0.6)),
    ),
  }));

  return (
    <div className="space-y-5">
      <div
        className="p-5 rounded-2xl"
        style={{
          background: "rgba(17,24,39,0.7)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-5">
          Proficiency Levels
        </h4>
        <div className="space-y-4">
          {bars.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-200">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">
                    {s.yrs}yr{s.yrs !== 1 ? "s" : ""}
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{
                      color:
                        s.level >= 85
                          ? "#00D4FF"
                          : s.level >= 70
                            ? "#7C3AED"
                            : "#64748B",
                    }}
                  >
                    {s.level}%
                  </span>
                </div>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.level}%` }}
                  transition={{
                    delay: 0.2 + i * 0.07,
                    duration: 0.7,
                    ease: "easeOut",
                  }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      s.level >= 85
                        ? "linear-gradient(90deg,#00D4FF,#7C3AED)"
                        : s.level >= 70
                          ? "#7C3AED"
                          : "#334155",
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {inferred.length > 0 && (
        <div
          className="p-5 rounded-2xl"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(124,58,237,0.15)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={13} className="text-violet-400" />
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-violet-400">
              Inferred Skills
            </h4>
            <span className="text-[9px] font-mono text-slate-600 ml-1">
              — AI-derived from skill graph
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inferred.map((s) => (
              <span
                key={s}
                className="px-3 py-1 rounded-lg text-xs font-mono text-violet-300"
                style={{
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
              >
                ≈ {s}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-3 font-mono">
            Inferred via knowledge graph traversal — not explicitly stated by
            freelancer.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Work History Tab ──────────────────────────────────────────────────────────
const HISTORY_POOL = [
  {
    title: "ML Pipeline Engineer",
    company: "DataFlow AI",
    duration: "8 months",
    year: 2024,
    skills: ["Python", "ML"],
    outcome: "Delivered 3× throughput improvement on inference pipeline.",
  },
  {
    title: "Backend Developer",
    company: "PayStream",
    duration: "6 months",
    year: 2023,
    skills: ["FastAPI", "PostgreSQL"],
    outcome: "Built core payment API handling 100k req/day.",
  },
  {
    title: "Platform Engineer",
    company: "CloudBase",
    duration: "1 year",
    year: 2022,
    skills: ["Docker", "DevOps"],
    outcome: "Led migration to Kubernetes — zero downtime.",
  },
  {
    title: "Frontend Lead",
    company: "SaaSly",
    duration: "4 months",
    year: 2022,
    skills: ["React", "UI/UX"],
    outcome: "Achieved perfect Lighthouse score across all pages.",
  },
  {
    title: "Data Scientist",
    company: "InsureTech",
    duration: "10 months",
    year: 2021,
    skills: ["Data Science", "Python"],
    outcome: "Risk model improved accuracy by 35%.",
  },
  {
    title: "UI/UX Designer",
    company: "HealthSync",
    duration: "6 months",
    year: 2023,
    skills: ["UI/UX", "Figma"],
    outcome: "Designed onboarding flow reducing churn by 22%.",
  },
  {
    title: "API Developer",
    company: "Logistics.io",
    duration: "5 months",
    year: 2023,
    skills: ["Node.js", "PostgreSQL"],
    outcome: "Shipped real-time tracking API used by 500k users.",
  },
  {
    title: "DevOps Lead",
    company: "FintechBase",
    duration: "1 year",
    year: 2021,
    skills: ["DevOps", "Docker"],
    outcome: "Reduced deployment times by 80% via GitOps.",
  },
];

function WorkHistoryTab({ f }) {
  const matches = HISTORY_POOL.filter((w) =>
    w.skills.some((s) => f.skills.includes(s)),
  ).slice(0, 5);

  return (
    <div className="space-y-3">
      {matches.map((w, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.09 }}
          className="p-5 rounded-2xl"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-sm">{w.title}</h4>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                {w.company} · {w.duration} · {w.year}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
              {w.skills.map((s) => {
                const matched = f.skills.includes(s);
                return (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{
                      background: matched
                        ? "rgba(0,212,255,0.1)"
                        : "rgba(255,255,255,0.04)",
                      color: matched ? "#00D4FF" : "#64748B",
                      border: `1px solid ${matched ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {s}
                  </span>
                );
              })}
            </div>
          </div>
          <div
            className="mt-3 pt-3 flex items-start gap-2 text-xs text-slate-400"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <CheckCircle2
              size={12}
              className="text-emerald-400 flex-shrink-0 mt-0.5"
            />
            {w.outcome}
          </div>
        </motion.div>
      ))}
      {matches.length === 0 && (
        <div className="text-center py-16 text-slate-600 font-mono text-sm">
          No matching work history found
        </div>
      )}
    </div>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────
function ReviewsTab({ f }) {
  const velocity =
    f.account_age_days > 0 ? (f.review_count / f.account_age_days) * 30 : 0;
  const isAnomaly = velocity > 5 || (f.rating >= 4.9 && f.review_count > 50);

  return (
    <div className="space-y-5">
      {isAnomaly && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <AlertTriangle
            size={16}
            className="text-yellow-400 flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="text-yellow-300 text-sm font-semibold">
              Review Anomaly Detected
            </p>
            <p className="text-yellow-400/70 text-xs mt-0.5 font-mono">
              {velocity > 5
                ? `High velocity: ${velocity.toFixed(1)} reviews/month`
                : ""}
              {f.rating >= 4.9 && f.review_count > 50
                ? (velocity > 5 ? " · " : "") +
                  "Suspiciously perfect rating across large sample"
                : ""}
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Avg Rating",
            value: `${Number(f.rating).toFixed(1)} ★`,
            color: "#F59E0B",
          },
          { label: "Total Reviews", value: f.review_count, color: "#00D4FF" },
          {
            label: "Velocity",
            value: `${velocity.toFixed(1)}/mo`,
            color: velocity > 5 ? "#EF4444" : "#10B981",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-2xl text-center"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="text-xl font-mono font-bold"
              style={{ color: s.color }}
            >
              {s.value}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {(f.reviews ?? []).map((r, i) => {
          const suspiciousAuthor =
            r.author.toLowerCase().includes("anonymous") ||
            r.author.toLowerCase().includes("unknown") ||
            r.author.toLowerCase().includes("ghost") ||
            r.author.toLowerCase().includes("shell");
          const shortReview = r.text.split(" ").length < 6;
          const flag = suspiciousAuthor || shortReview;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-2xl"
              style={{
                background: "rgba(17,24,39,0.7)",
                border: `1px solid ${flag ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">
                      {r.author}
                    </span>
                    {flag && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono text-yellow-400 uppercase tracking-widest"
                        style={{
                          background: "rgba(245,158,11,0.1)",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        ⚠ Suspicious
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={11}
                        className={
                          r.rating >= s
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-700"
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                "{r.text}"
              </p>
              {flag && (
                <p className="text-yellow-500/60 text-[10px] font-mono mt-2">
                  ⚑ {shortReview ? "Unusually short review" : ""}
                  {shortReview && suspiciousAuthor ? " · " : ""}
                  {suspiciousAuthor ? "Unverifiable reviewer identity" : ""}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fraud Report Tab ──────────────────────────────────────────────────────────
function FraudReportTab({ f }) {
  const pct = Math.round(f.fraud_score * 100);
  const vel =
    f.account_age_days > 0
      ? ((f.review_count / f.account_age_days) * 30).toFixed(1)
      : "0.0";
  const rateMismatch = f.hourly_rate > 130 && f.experience_years < 3;
  const highVel = parseFloat(vel) > 5;

  const aiText = `Comprehensive fraud assessment for ${f.name} (ID #${f.id}). Account registered ${f.account_age_days} days ago — ${f.account_age_days < 30 ? "HIGH RISK: very new account" : "account tenure is normal"}. Hourly rate of $${f.hourly_rate}/hr with ${f.experience_years} years experience ${rateMismatch ? "shows a significant rate-experience mismatch — red flag" : "is consistent with stated experience"}. Review count of ${f.review_count} at a velocity of ${vel}/month — ${highVel ? "ANOMALOUS velocity detected — potential review ring" : "within normal range"}. Final Bayesian posterior probability: ${pct}%. Confidence: 92%. Verdict: ${pct < 30 ? "AUTHENTIC — proceed with standard vetting." : pct < 70 ? "SUSPICIOUS — enhanced manual verification required before contract." : "FRAUDULENT — BLOCK RECOMMENDED, escalate to fraud review team immediately."}`;

  return (
    <div className="space-y-5">
      <div
        className="flex flex-col items-center gap-5 p-6 rounded-2xl"
        style={{
          background: "rgba(17,24,39,0.8)",
          border: `1px solid ${f.fraud_score < 0.3 ? "rgba(16,185,129,0.2)" : f.fraud_score < 0.7 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.25)"}`,
        }}
      >
        <FraudGauge score={f.fraud_score} size={160} thickness={12} />
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-slate-500 uppercase">
            <span>Confidence Index</span>
            <span className="text-cyan-400">92%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "92%" }}
              transition={{ delay: 0.5, duration: 0.9 }}
              className="h-full rounded-full bg-cyan-400"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Account Age",
            value: `${f.account_age_days}d`,
            warn: f.account_age_days < 30,
          },
          {
            label: "Reviews",
            value: f.review_count,
            warn: f.review_count > 80,
          },
          { label: "Rate", value: `$${f.hourly_rate}/hr`, warn: rateMismatch },
        ].map((s) => (
          <div
            key={s.label}
            className="p-3 rounded-xl text-center"
            style={{
              background: s.warn
                ? "rgba(239,68,68,0.06)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${s.warn ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <div
              className={`text-lg font-mono font-bold ${s.warn ? "text-red-400" : "text-white"}`}
            >
              {s.value}
            </div>
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <AIReasoningBox
        key={`fraud-${f.id}`}
        text={aiText}
        speed={14}
        title="FRAUD RISK ASSESSMENT"
      />

      <a
        href="/fraud"
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-mono text-sm font-bold uppercase tracking-wider text-white transition-all"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.22)",
        }}
      >
        <ShieldAlert size={16} className="text-red-400" /> Open Fraud Lab
      </a>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage({ params }) {
  const id = parseInt(params.id, 10);
  const f = FREELANCERS.find((fl) => fl.id === id);
  const [activeTab, setActiveTab] = useState("Overview");

  if (!f) {
    return (
      <AppLayout title="Profile Not Found">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <ShieldAlert size={36} className="text-red-400" />
          <p className="text-slate-400 font-mono text-sm">
            Freelancer #{id} not found in system.
          </p>
          <a
            href="/search"
            className="text-cyan-400 font-mono text-xs uppercase tracking-widest hover:text-cyan-300 transition-colors"
          >
            ← Back to Search
          </a>
        </div>
      </AppLayout>
    );
  }

  const fraudColor =
    f.fraud_score < 0.3
      ? "#10B981"
      : f.fraud_score < 0.7
        ? "#F59E0B"
        : "#EF4444";

  return (
    <AppLayout title="Freelancer Profile">
      <div className="space-y-6 pb-10 max-w-5xl">
        {/* Back */}
        <a
          href="/search"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-mono uppercase tracking-widest transition-colors"
        >
          <ArrowLeft size={13} /> Back to Search
        </a>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl"
          style={{
            background: "rgba(17,24,39,0.8)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-mono font-bold text-white flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,58,237,0.25))",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {f.avatar}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-white">{f.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-mono text-slate-500">
                    {f.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {f.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DollarSign size={10} /> ${f.hourly_rate}/hr
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {f.experience_years}y exp
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={13}
                        className={
                          f.rating >= s
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-700"
                        }
                      />
                    ))}
                    <span className="text-slate-400 text-xs ml-1 font-mono">
                      {Number(f.rating).toFixed(1)}
                    </span>
                    <span className="text-slate-600 text-xs font-mono">
                      ({f.review_count} reviews)
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-mono uppercase tracking-widest"
                    style={
                      f.availability
                        ? {
                            color: "#10B981",
                            background: "rgba(16,185,129,0.1)",
                            border: "1px solid rgba(16,185,129,0.2)",
                          }
                        : {
                            color: "#64748B",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    {f.availability ? "✓ Available" : "Unavailable"}
                  </span>
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-mono uppercase tracking-widest"
                    style={{
                      color: fraudColor,
                      background: fraudColor + "15",
                      border: `1px solid ${fraudColor}35`,
                    }}
                  >
                    {f.fraud_score < 0.3
                      ? "✓ Low Risk"
                      : f.fraud_score < 0.7
                        ? "⚠ Moderate Risk"
                        : "🚨 High Risk"}
                  </span>
                </div>
              </div>

              <div
                className="flex flex-wrap gap-1.5 mt-4 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {f.skills.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-300"
                    style={{
                      background: "rgba(0,212,255,0.08)",
                      border: "1px solid rgba(0,212,255,0.18)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex gap-2 mt-5 pt-5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <a
              href="/team-builder"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-black"
              style={{ background: "linear-gradient(135deg,#00D4FF,#7C3AED)" }}
            >
              <Users size={13} /> Add to Team
            </a>
            <a
              href="/fraud"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-red-400 transition-colors"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <ShieldAlert size={13} /> Fraud Report
            </a>
          </div>
        </motion.div>

        {/* Tab bar */}
        <div
          className="flex gap-1 p-1 rounded-2xl flex-wrap"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
              style={
                activeTab === tab
                  ? {
                      background: "rgba(0,212,255,0.1)",
                      color: "#00D4FF",
                      border: "1px solid rgba(0,212,255,0.22)",
                    }
                  : { color: "#64748B", border: "1px solid transparent" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "Overview" && <OverviewTab f={f} />}
            {activeTab === "Skills" && <SkillsTab f={f} />}
            {activeTab === "Work History" && <WorkHistoryTab f={f} />}
            {activeTab === "Reviews" && <ReviewsTab f={f} />}
            {activeTab === "Fraud Report" && <FraudReportTab f={f} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
