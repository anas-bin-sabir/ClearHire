"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Star, MapPin, Clock, DollarSign, ShieldAlert, ArrowLeft, Users, CheckCircle2, AlertTriangle, Briefcase, Calendar, TrendingUp, Zap } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FraudGauge from "@/components/FraudGauge";
import AIReasoningBox from "@/components/AIReasoningBox";
import { getFreelancer, enrichFreelancer, getFraudScore, type FraudResponse } from "@/lib/api";

const TABS = ["Overview", "Skills", "Work History", "Reviews", "Fraud Report"];

const SKILL_ADJ: Record<string, string[]> = {
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

function inferSkills(skills: string[]) {
  const inferred = new Set<string>();
  for (const s of skills) { for (const rel of SKILL_ADJ[s] ?? []) { if (!skills.includes(rel)) inferred.add(rel); } }
  return [...inferred];
}

function seededRand(seed: number) { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); }

function AvailabilityGrid({ available, seed }: { available: boolean; seed: number }) {
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const cells = Array.from({ length: 28 }, (_, i) => ({ active: available ? seededRand(seed + i) > 0.25 : seededRand(seed + i) > 0.75 }));
  return (
    <div className="space-y-2">
      <div className="flex gap-1">{days.map((d) => <div key={d} className="flex-1 text-center text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>{d}</div>)}</div>
      {[0,1,2,3].map((w) => (
        <div key={w} className="flex gap-1">
          {cells.slice(w * 7, w * 7 + 7).map((c, i) => (
            <div key={i} className="flex-1 h-6 rounded-md" style={{ background: c.active ? `rgba(var(--color-primary-rgb), 0.18)` : `rgba(var(--border-base), 0.04)`, border: `1px solid ${c.active ? `rgba(var(--color-primary-rgb), 0.3)` : `rgba(var(--border-base), 0.06)`}` }} />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-4 text-[9px] font-mono mt-1" style={{ color: "var(--text-subtle)" }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: `rgba(var(--color-primary-rgb), 0.18)`, border: `1px solid rgba(var(--color-primary-rgb), 0.3)` }} />Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: `rgba(var(--border-base), 0.04)` }} />Booked</span>
      </div>
    </div>
  );
}

function OverviewTab({ f }: { f: any }) {
  const stats = [
    { label: "Experience", value: `${f.experience_years}y`, icon: Briefcase, colorVar: "var(--color-primary)" },
    { label: "Hourly Rate", value: `$${f.hourly_rate}`, icon: DollarSign, colorVar: "var(--color-secondary)" },
    { label: "Reviews", value: f.review_count, icon: Star, colorVar: "var(--color-warning)" },
    { label: "Account Age", value: `${f.account_age_days}d`, icon: Calendar, colorVar: "var(--color-success)" },
  ];
  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="p-4 rounded-2xl" style={cardStyle}>
            <s.icon size={16} style={{ color: s.colorVar }} className="mb-2" />
            <div className="text-xl font-mono font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "var(--text-subtle)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="p-5 rounded-2xl" style={cardStyle}>
        <h4 className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-subtle)" }}>About</h4>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.bio}</p>
      </div>
      <div className="p-5 rounded-2xl" style={cardStyle}>
        <h4 className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)" }}>Availability — Next 4 Weeks</h4>
        <AvailabilityGrid available={f.availability} seed={f.id * 17} />
      </div>
    </div>
  );
}

function SkillsTab({ f }: { f: any }) {
  const inferred = inferSkills(f.skills);
  const bars = f.skills.map((s: string, i: number) => ({ name: s, level: 60 + Math.floor(seededRand(f.id * 31 + i) * 40), yrs: Math.max(1, Math.round(f.experience_years * (0.4 + seededRand(f.id + i * 7) * 0.6))) }));
  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` };
  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl" style={cardStyle}>
        <h4 className="text-[10px] font-mono uppercase tracking-widest mb-5" style={{ color: "var(--text-subtle)" }}>Proficiency Levels</h4>
        <div className="space-y-4">
          {bars.map((s: any, i: number) => (
            <motion.div key={s.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>{s.yrs}yr{s.yrs !== 1 ? "s" : ""}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: s.level >= 85 ? "var(--color-primary)" : s.level >= 70 ? "var(--color-secondary)" : "var(--text-subtle)" }}>{s.level}%</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.level}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.7 }} className="h-full rounded-full"
                  style={{ background: s.level >= 85 ? `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` : s.level >= 70 ? "var(--color-secondary)" : "var(--text-muted)" }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {inferred.length > 0 && (
        <div className="p-5 rounded-2xl" style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--color-secondary-rgb), 0.15)` }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={13} style={{ color: "var(--color-secondary)" }} />
            <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-secondary)" }}>Inferred Skills</h4>
            <span className="text-[9px] font-mono ml-1" style={{ color: "var(--text-subtle)" }}>— AI-derived from skill graph</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inferred.map((s) => (
              <span key={s} className="px-3 py-1 rounded-lg text-xs font-mono" style={{ background: `rgba(var(--color-secondary-rgb), 0.1)`, border: `1px solid rgba(var(--color-secondary-rgb), 0.2)`, color: "var(--color-secondary)" }}>≈ {s}</span>
            ))}
          </div>
          <p className="text-[10px] font-mono mt-3" style={{ color: "var(--text-subtle)" }}>Inferred via knowledge graph traversal — not explicitly stated by freelancer.</p>
        </div>
      )}
    </div>
  );
}

const HISTORY_POOL = [
  { title: "ML Pipeline Engineer", company: "DataFlow AI", duration: "8 months", year: 2024, skills: ["Python", "ML"], outcome: "Delivered 3× throughput improvement on inference pipeline." },
  { title: "Backend Developer", company: "PayStream", duration: "6 months", year: 2023, skills: ["FastAPI", "PostgreSQL"], outcome: "Built core payment API handling 100k req/day." },
  { title: "Platform Engineer", company: "CloudBase", duration: "1 year", year: 2022, skills: ["Docker", "DevOps"], outcome: "Led migration to Kubernetes — zero downtime." },
  { title: "Frontend Lead", company: "SaaSly", duration: "4 months", year: 2022, skills: ["React", "UI/UX"], outcome: "Achieved perfect Lighthouse score across all pages." },
  { title: "Data Scientist", company: "InsureTech", duration: "10 months", year: 2021, skills: ["Data Science", "Python"], outcome: "Risk model improved accuracy by 35%." },
  { title: "UI/UX Designer", company: "HealthSync", duration: "6 months", year: 2023, skills: ["UI/UX", "Figma"], outcome: "Designed onboarding flow reducing churn by 22%." },
  { title: "API Developer", company: "Logistics.io", duration: "5 months", year: 2023, skills: ["Node.js", "PostgreSQL"], outcome: "Shipped real-time tracking API used by 500k users." },
  { title: "DevOps Lead", company: "FintechBase", duration: "1 year", year: 2021, skills: ["DevOps", "Docker"], outcome: "Reduced deployment times by 80% via GitOps." },
];

function WorkHistoryTab({ f }: { f: any }) {
  const matches = HISTORY_POOL.filter((w) => w.skills.some((s) => f.skills.includes(s))).slice(0, 5);
  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` };
  return (
    <div className="space-y-3">
      {matches.map((w, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09 }} className="p-5 rounded-2xl" style={cardStyle}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{w.title}</h4>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>{w.company} · {w.duration} · {w.year}</p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
              {w.skills.map((s) => {
                const matched = f.skills.includes(s);
                return <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: matched ? `rgba(var(--color-primary-rgb), 0.1)` : `rgba(var(--border-base), 0.04)`, color: matched ? "var(--color-primary)" : "var(--text-subtle)", border: `1px solid ${matched ? `rgba(var(--color-primary-rgb), 0.2)` : `rgba(var(--border-base), 0.08)`}` }}>{s}</span>;
              })}
            </div>
          </div>
          <div className="mt-3 pt-3 flex items-start gap-2 text-xs" style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)`, color: "var(--text-muted)" }}>
            <CheckCircle2 size={12} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 2 }} />
            {w.outcome}
          </div>
        </motion.div>
      ))}
      {matches.length === 0 && <div className="text-center py-16 font-mono text-sm" style={{ color: "var(--text-subtle)" }}>No matching work history found</div>}
    </div>
  );
}

function ReviewsTab({ f }: { f: any }) {
  const velocity = f.account_age_days > 0 ? (f.review_count / f.account_age_days) * 30 : 0;
  const isAnomaly = velocity > 5 || (f.rating >= 4.9 && f.review_count > 50);
  return (
    <div className="space-y-5">
      {isAnomaly && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: `rgba(var(--color-warning-rgb), 0.07)`, border: `1px solid rgba(var(--color-warning-rgb), 0.2)` }}>
          <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-300">Review Anomaly Detected</p>
            <p className="text-xs mt-0.5 font-mono text-yellow-400/70">
              {velocity > 5 ? `High velocity: ${velocity.toFixed(1)} reviews/month` : ""}
              {f.rating >= 4.9 && f.review_count > 50 ? (velocity > 5 ? " · " : "") + "Suspiciously perfect rating across large sample" : ""}
            </p>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Avg Rating", value: `${Number(f.rating).toFixed(1)} ★`, colorVar: "var(--color-warning)" },
          { label: "Total Reviews", value: f.review_count, colorVar: "var(--color-primary)" },
          { label: "Velocity", value: `${velocity.toFixed(1)}/mo`, colorVar: velocity > 5 ? "var(--color-danger)" : "var(--color-success)" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl text-center" style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` }}>
            <div className="text-xl font-mono font-bold" style={{ color: s.colorVar }}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "var(--text-subtle)" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {(f.reviews ?? []).map((r: any, i: number) => {
          const suspiciousAuthor = r.author.toLowerCase().includes("anonymous") || r.author.toLowerCase().includes("unknown") || r.author.toLowerCase().includes("ghost") || r.author.toLowerCase().includes("shell");
          const shortReview = r.text.split(" ").length < 6;
          const flag = suspiciousAuthor || shortReview;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-4 rounded-2xl"
              style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid ${flag ? `rgba(var(--color-warning-rgb), 0.2)` : `rgba(var(--border-base), 0.06)`}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{r.author}</span>
                    {flag && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest text-yellow-400" style={{ background: `rgba(var(--color-warning-rgb), 0.1)`, border: `1px solid rgba(var(--color-warning-rgb), 0.2)` }}>⚠ Suspicious</span>}
                  </div>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={11} className={r.rating >= s ? "text-yellow-400 fill-yellow-400" : "text-slate-700"} />)}
                  </div>
                </div>
              </div>
              <p className="text-xs mt-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>"{r.text}"</p>
              {flag && <p className="text-[10px] font-mono mt-2" style={{ color: "rgba(var(--color-warning-rgb), 0.6)" }}>⚑ {shortReview ? "Unusually short review" : ""}{shortReview && suspiciousAuthor ? " · " : ""}{suspiciousAuthor ? "Unverifiable reviewer identity" : ""}</p>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function FraudReportTab({ f }: { f: any }) {
  const [fraudData, setFraudData] = useState<FraudResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getFraudScore({ freelancer_id: f.id, name: f.name, account_age_days: f.account_age_days, rating: f.rating, hourly_rate: f.hourly_rate, experience_years: f.experience_years, review_count: f.review_count, portfolio_urls: f.portfolio_urls, skills: f.skills }).then(setFraudData).catch(() => setFraudData(null)).finally(() => setLoading(false)); }, [f]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="font-mono text-sm" style={{ color: "var(--text-subtle)" }}>Loading fraud analysis...</div></div>;

  const score = fraudData?.score ?? f.fraud_score;
  const vel = f.account_age_days > 0 ? ((f.review_count / f.account_age_days) * 30).toFixed(1) : "0.0";
  const rateMismatch = f.hourly_rate > 130 && f.experience_years < 3;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-5 p-6 rounded-2xl"
        style={{ background: `rgba(var(--bg-secondary-rgb), 0.8)`, border: `1px solid ${score < 0.3 ? `rgba(var(--color-success-rgb), 0.2)` : score < 0.7 ? `rgba(var(--color-warning-rgb), 0.2)` : `rgba(var(--color-danger-rgb), 0.25)`}` }}>
        <FraudGauge score={score} size={160} thickness={12} />
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-[10px] font-mono uppercase" style={{ color: "var(--text-subtle)" }}>
            <span>Confidence Index</span>
            <span style={{ color: "var(--color-primary)" }}>{fraudData?.confidence === "high" ? "95%" : fraudData?.confidence === "medium" ? "80%" : "60%"}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
            <motion.div initial={{ width: 0 }} animate={{ width: fraudData?.confidence === "high" ? "95%" : fraudData?.confidence === "medium" ? "80%" : "60%" }} transition={{ delay: 0.5, duration: 0.9 }} className="h-full rounded-full" style={{ background: "var(--color-primary)" }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Account Age", value: `${f.account_age_days}d`, warn: f.account_age_days < 30 }, { label: "Reviews", value: f.review_count, warn: f.review_count > 80 }, { label: "Rate", value: `$${f.hourly_rate}/hr`, warn: rateMismatch }].map((s) => (
          <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: s.warn ? `rgba(var(--color-danger-rgb), 0.06)` : `rgba(var(--border-base), 0.03)`, border: `1px solid ${s.warn ? `rgba(var(--color-danger-rgb), 0.2)` : `rgba(var(--border-base), 0.06)`}` }}>
            <div className="text-lg font-mono font-bold" style={{ color: s.warn ? "var(--color-danger)" : "var(--text-primary)" }}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "var(--text-subtle)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <AIReasoningBox key={`fraud-${f.id}`} text={fraudData?.explanation || "Fetching fraud analysis..."} speed={14} title="FRAUD RISK ASSESSMENT" />

      <a href="/fraud" className="flex items-center justify-center gap-2 py-3 rounded-2xl font-mono text-sm font-bold uppercase tracking-wider transition-all"
        style={{ background: `rgba(var(--color-danger-rgb), 0.08)`, border: `1px solid rgba(var(--color-danger-rgb), 0.22)`, color: "var(--text-secondary)" }}>
        <ShieldAlert size={16} style={{ color: "var(--color-danger)" }} /> Open Fraud Lab
      </a>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const id = parseInt(String(params?.id ?? ""), 10);
  const [f, setF] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (!id || Number.isNaN(id)) { setLoading(false); return; }
    getFreelancer(id).then((row) => setF(enrichFreelancer(row))).catch(() => setF(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <AppLayout title="Freelancer Profile">
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `rgba(var(--color-primary-rgb), 0.3)`, borderTopColor: "var(--color-primary)" }} />
      </div>
    </AppLayout>
  );

  if (!f) return (
    <AppLayout title="Profile Not Found">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldAlert size={36} style={{ color: "var(--color-danger)" }} />
        <p className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>Freelancer #{id} not found in system.</p>
        <Link href="/search" className="font-mono text-xs uppercase tracking-widest transition-colors" style={{ color: "var(--color-primary)" }}>← Back to Search</Link>
      </div>
    </AppLayout>
  );

  const fraudColor = f.fraud_score < 0.3 ? "var(--color-success)" : f.fraud_score < 0.7 ? "var(--color-warning)" : "var(--color-danger)";
  const fraudRgb = f.fraud_score < 0.3 ? "var(--color-success-rgb)" : f.fraud_score < 0.7 ? "var(--color-warning-rgb)" : "var(--color-danger-rgb)";

  return (
    <AppLayout title="Freelancer Profile">
      <div className="space-y-6 pb-10 max-w-5xl">
        <Link href="/search" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors" style={{ color: "var(--text-subtle)" }}>
          <ArrowLeft size={13} /> Back to Search
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl"
          style={{ background: `rgba(var(--bg-secondary-rgb), 0.8)`, border: `1px solid rgba(var(--border-base), 0.07)` }}>
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-mono font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.2), rgba(var(--color-secondary-rgb),0.25))`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" }}>
              {f.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{f.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-mono" style={{ color: "var(--text-subtle)" }}>
                    {f.location && <span className="flex items-center gap-1"><MapPin size={10} /> {f.location}</span>}
                    <span className="flex items-center gap-1"><DollarSign size={10} /> ${f.hourly_rate}/hr</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {f.experience_years}y exp</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={13} className={f.rating >= s ? "text-yellow-400 fill-yellow-400" : "text-slate-700"} />)}
                    <span className="text-xs ml-1 font-mono" style={{ color: "var(--text-muted)" }}>{Number(f.rating).toFixed(1)}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>({f.review_count} reviews)</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="px-3 py-1 rounded-xl text-xs font-mono uppercase tracking-widest"
                    style={f.availability ? { color: "var(--color-success)", background: `rgba(var(--color-success-rgb), 0.1)`, border: `1px solid rgba(var(--color-success-rgb), 0.2)` } : { color: "var(--text-subtle)", background: `rgba(var(--border-base), 0.04)`, border: `1px solid rgba(var(--border-base), 0.08)` }}>
                    {f.availability ? "✓ Available" : "Unavailable"}
                  </span>
                  <span className="px-3 py-1 rounded-xl text-xs font-mono uppercase tracking-widest"
                    style={{ color: fraudColor, background: `rgba(${fraudRgb}, 0.15)`, border: `1px solid rgba(${fraudRgb}, 0.35)` }}>
                    {f.fraud_score < 0.3 ? "✓ Low Risk" : f.fraud_score < 0.7 ? "⚠ Moderate Risk" : "🚨 High Risk"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4" style={{ borderTop: `1px solid rgba(var(--border-base), 0.06)` }}>
                {f.skills.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-mono" style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, border: `1px solid rgba(var(--color-primary-rgb), 0.18)`, color: "var(--color-primary)" }}>{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-5 pt-5" style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)` }}>
            <Link href="/team-builder" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white"
              style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
              <Users size={13} /> Add to Team
            </Link>
            <Link href="/fraud" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-colors"
              style={{ background: `rgba(var(--color-danger-rgb), 0.08)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)`, color: "var(--color-danger)" }}>
              <ShieldAlert size={13} /> Fraud Report
            </Link>
          </div>
        </motion.div>

        <div className="flex gap-1 p-1 rounded-2xl flex-wrap" style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
              style={activeTab === tab ? { background: `rgba(var(--color-primary-rgb), 0.1)`, color: "var(--color-primary)", border: `1px solid rgba(var(--color-primary-rgb), 0.22)` } : { color: "var(--text-subtle)", border: "1px solid transparent" }}>
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
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
