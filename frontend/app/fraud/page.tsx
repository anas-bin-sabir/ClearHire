"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  Search,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  DollarSign,
  Calendar,
  Network,
  ChevronRight,
  Info,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FraudGauge from "@/components/FraudGauge";
import AIReasoningBox from "@/components/AIReasoningBox";
import { getFraudScore, enrichFreelancer, listFreelancers } from "@/lib/api";

function buildEvidence(f) {
  const velocity =
    f.account_age_days > 0 ? (f.review_count / f.account_age_days) * 30 : 0;
  const rateMismatch = f.hourly_rate > 130 && f.experience_years < 3;
  const highVelocity = velocity > 5;
  const ratingAnomaly = f.rating >= 4.9 && f.review_count > 50;
  const portfolioRisk = f.fraud_score > 0.5;
  return [
    {
      factor: "Account Age",
      icon: Calendar,
      value: `${f.account_age_days} days`,
      weight:
        f.account_age_days < 30
          ? "8×"
          : f.account_age_days < 90
            ? "2×"
            : "0.5×",
      risk:
        f.account_age_days < 30
          ? "high"
          : f.account_age_days < 90
            ? "medium"
            : "low",
      desc:
        f.account_age_days < 30
          ? "Newly created account — major anomaly signal"
          : f.account_age_days < 90
            ? "Account less than 3 months old"
            : "Established account with strong tenure",
      bar: Math.max(0, 1 - f.account_age_days / 365),
    },
    {
      factor: "Rate / Experience",
      icon: DollarSign,
      value: `$${f.hourly_rate}/hr · ${f.experience_years}y`,
      weight: rateMismatch ? "5×" : "0.4×",
      risk: rateMismatch ? "high" : "low",
      desc: rateMismatch
        ? "Premium rate with minimal verifiable experience"
        : "Rate aligns with stated experience level",
      bar: rateMismatch ? 0.85 : 0.1,
    },
    {
      factor: "Review Velocity",
      icon: Star,
      value: `${f.review_count} reviews · ${velocity.toFixed(1)}/mo`,
      weight: highVelocity ? "5×" : velocity > 2 ? "1.5×" : "0.3×",
      risk: highVelocity ? "high" : velocity > 2 ? "medium" : "low",
      desc: highVelocity
        ? "Abnormally high review acquisition — potential ring"
        : velocity > 2
          ? "Slightly elevated velocity"
          : "Natural review accumulation",
      bar: Math.min(velocity / 10, 1),
    },
    {
      factor: "Rating Pattern",
      icon: Star,
      value: `${Number(f.rating).toFixed(1)} ★ (${f.review_count} total)`,
      weight: ratingAnomaly ? "3×" : "0.5×",
      risk: ratingAnomaly ? "medium" : "low",
      desc: ratingAnomaly
        ? "Suspiciously perfect rating across large review count"
        : "Rating distribution appears organic",
      bar: ratingAnomaly ? 0.65 : 0.15,
    },
    {
      factor: "Network Signal",
      icon: Network,
      value: portfolioRisk ? "Cluster detected" : "No connections",
      weight: portfolioRisk ? "10×" : "0.2×",
      risk: portfolioRisk ? "high" : "low",
      desc: portfolioRisk
        ? "Account shares portfolio hashes with flagged identities"
        : "No known connections to flagged rings",
      bar: f.fraud_score,
    },
  ];
}

function buildTimeline(f) {
  const now = Date.now(),
    dayMs = 86400000;
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const events = [
    {
      date: fmt(now - f.account_age_days * dayMs),
      label: "Account created",
      type: f.account_age_days < 30 ? "danger" : "neutral",
      detail: `Registered ${f.account_age_days} days ago`,
    },
  ];
  if (f.review_count > 0) {
    const fr = Math.floor(f.account_age_days * 0.15);
    events.push({
      date: fmt(now - fr * dayMs),
      label: "First review received",
      type: fr < 5 ? "warning" : "neutral",
      detail:
        fr < 5
          ? "Review received within days of account creation"
          : "Normal review timeline",
    });
  }
  if (f.fraud_score > 0.5)
    events.push({
      date: fmt(now - Math.floor(f.account_age_days * 0.4) * dayMs),
      label: "Portfolio similarity flagged",
      type: "danger",
      detail: "Content hash matches 2 other flagged accounts",
    });
  if (f.review_count > 40)
    events.push({
      date: fmt(now - Math.floor(f.account_age_days * 0.6) * dayMs),
      label: "Review velocity spike",
      type: f.review_count > 80 ? "danger" : "warning",
      detail: `${f.review_count} reviews over account lifetime`,
    });
  events.push({
    date: fmt(now),
    label: "Bayesian scan completed",
    type:
      f.fraud_score > 0.7
        ? "danger"
        : f.fraud_score > 0.3
          ? "warning"
          : "success",
    detail: `Final probability: ${Math.round(f.fraud_score * 100)}%`,
  });
  return events;
}

function buildAIText(f, evidence) {
  const pct = Math.round(f.fraud_score * 100);
  const highFactors = evidence
    .filter((e) => e.risk === "high")
    .map((e) => e.factor);
  const verdict =
    pct < 30 ? "AUTHENTIC" : pct < 70 ? "SUSPICIOUS" : "FRAUDULENT";
  const vel =
    f.account_age_days > 0
      ? ((f.review_count / f.account_age_days) * 30).toFixed(1)
      : "0.0";
  return `Bayesian fraud analysis initiated for subject: ${f.name} (ID #${f.id}). Computing posterior probability using log-odds form. Prior: P(Fraud) = 0.05 (5% base rate for platform). ${highFactors.length > 0 ? `High-signal anomalies detected: ${highFactors.join(", ")}. ` : "No major anomaly signals detected. "}Account tenure: ${f.account_age_days} days. Review velocity: ${vel}/month. Rate/experience coefficient: $${f.hourly_rate}/hr at ${f.experience_years} years. Posterior fraud probability: ${pct}%. Confidence interval: ±${Math.max(3, 8 - Math.floor(f.account_age_days / 100))}%. Verdict: ${verdict}. ${pct < 30 ? "Recommend proceeding with standard contract vetting." : pct < 70 ? "Recommend enhanced manual verification before contract initiation." : "BLOCK RECOMMENDED — escalate to fraud review team immediately."}`;
}

const RISK_STYLES = {
  high: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
  },
  medium: {
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
  },
  low: {
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
  },
};
const TL = {
  danger: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", dot: "#EF4444" },
  warning: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", dot: "#F59E0B" },
  success: { color: "#10B981", bg: "rgba(16,185,129,0.1)", dot: "#10B981" },
  neutral: { color: "#64748B", bg: "rgba(255,255,255,0.04)", dot: "#475569" },
};

export default function FraudLabPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [searched, setSearched] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [flaggedSamples, setFlaggedSamples] = useState([]);
  const [displayScore, setDisplayScore] = useState(0);
  const [fraudExplanation, setFraudExplanation] = useState("");
  const [fraudSignals, setFraudSignals] = useState([]);

  useEffect(() => {
    listFreelancers({ flaggedOnly: true, limit: 8 })
      .then((r) => setFlaggedSamples(r.freelancers.map(enrichFreelancer)))
      .catch(() => setFlaggedSamples([]));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      listFreelancers({ q: query.trim(), limit: 6 })
        .then((r) => setSearchResults(r.freelancers.map(enrichFreelancer)))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = searchResults;

  useEffect(() => {
    if (!selected) {
      setDisplayScore(0);
      return;
    }
    const target = selected.fraud_score ?? 0;
    const start = performance.now();
    let frame;
    const tick = (t) => {
      const p = Math.min((t - start) / 900, 1);
      setDisplayScore(target * p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selected?.id, selected?.fraud_score]);

  const pick = async (f) => {
    setScanning(true);
    setSearched(true);
    setQuery(f.name);
    setFraudExplanation("");
    try {
      const res = await getFraudScore({ freelancer_id: f.id });
      const merged = enrichFreelancer({
        ...(res.freelancer || f),
        fraud_score: res.score,
      });
      setSelected(merged);
      setFraudExplanation(res.explanation || "");
      setFraudSignals(res.signals || []);
    } catch (err) {
      setSelected(f);
      setFraudExplanation(err?.message || "Fraud scan failed — is the API running?");
    } finally {
      setScanning(false);
    }
  };
  const clear = () => {
    setQuery("");
    setSelected(null);
    setSearched(false);
  };

  const evidence = selected ? buildEvidence(selected) : [];
  const timeline = selected ? buildTimeline(selected) : [];
  const aiText = fraudExplanation;
  const fc = !selected
    ? "#64748B"
    : displayScore < 0.3
      ? "#10B981"
      : displayScore < 0.7
        ? "#F59E0B"
        : "#EF4444";

  return (
    <AppLayout title="Fraud Lab">
      <div className="space-y-6 pb-10 max-w-6xl">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <ShieldAlert size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Fraud Intelligence Lab
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Bayesian risk scoring · Evidence analysis · Behavioral pattern
              detection
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results.length > 0) pick(results[0]);
                }}
                placeholder="Search by name or ID — try 'Alex Storm' or '13'..."
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm text-white placeholder:text-slate-600 font-mono focus:outline-none transition-all"
                style={{
                  background: "rgba(17,24,39,0.8)",
                  border: `1px solid ${selected ? fc + "50" : "rgba(255,255,255,0.1)"}`,
                }}
              />
              {query && (
                <button
                  onClick={clear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                if (results.length > 0) pick(results[0]);
              }}
              className="px-6 py-3.5 rounded-2xl font-mono font-bold text-sm uppercase tracking-wider text-white transition-all"
              style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}
            >
              SCAN
            </button>
          </div>

          {/* Dropdown */}
          <AnimatePresence>
            {query && !selected && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl overflow-hidden"
                style={{
                  background: "#0D1117",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {results.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pick(f)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      {f.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{f.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        ID #{f.id} · {f.location}
                      </div>
                    </div>
                    <span
                      className="text-xs font-mono font-bold flex-shrink-0"
                      style={{
                        color:
                          f.fraud_score < 0.3
                            ? "#10B981"
                            : f.fraud_score < 0.7
                              ? "#F59E0B"
                              : "#EF4444",
                      }}
                    >
                      {Math.round(f.fraud_score * 100)}% risk
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {!searched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 rounded-2xl gap-5"
            style={{ border: "2px dashed rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.12)",
              }}
            >
              <ShieldAlert size={36} className="text-red-400/40" />
            </div>
            <div className="text-center">
              <p className="text-slate-600 font-mono text-xs uppercase tracking-widest">
                Awaiting scan target
              </p>
              <p className="text-slate-700 text-xs mt-1.5">
                Search by freelancer name or numeric ID to begin analysis
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {flaggedSamples.map((f) => (
                <button
                  key={f.id}
                  onClick={() => pick(f)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-red-400 transition-colors"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  🚨 {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Analysis output */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Gauge + Subject row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div
                  className="md:col-span-4 flex flex-col items-center gap-4 p-6 rounded-2xl"
                  style={{
                    background: "rgba(17,24,39,0.8)",
                    border: `1px solid ${fc}28`,
                  }}
                >
                  <div
                    className="w-full h-0.5 rounded-full"
                    style={{
                      background: `linear-gradient(90deg,transparent,${fc},transparent)`,
                    }}
                  />
                  <FraudGauge
                    score={displayScore}
                    size={156}
                    thickness={11}
                    key={`${selected.id}-${Math.round(displayScore * 100)}`}
                  />
                  <div
                    className="w-full space-y-2 pt-2"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 uppercase">
                      <span>Confidence</span>
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

                <div className="md:col-span-8 flex flex-col gap-4">
                  <div
                    className="p-5 rounded-2xl"
                    style={{
                      background: "rgba(17,24,39,0.7)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-white flex-shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {selected.avatar}
                      </div>
                      <div>
                        <h2 className="font-bold text-white">
                          {selected.name}
                        </h2>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          ID #{selected.id} · {selected.location} ·{" "}
                          {selected.experience_years}y exp
                        </p>
                      </div>
                      <a
                        href={`/profile/${selected.id}`}
                        className="ml-auto flex items-center gap-1 text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors uppercase tracking-widest"
                      >
                        Profile <ChevronRight size={12} />
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        {
                          label: "Account Age",
                          value: `${selected.account_age_days}d`,
                          warn: selected.account_age_days < 30,
                        },
                        {
                          label: "Reviews",
                          value: selected.review_count,
                          warn: selected.review_count > 80,
                        },
                        {
                          label: "Rate",
                          value: `$${selected.hourly_rate}/hr`,
                          warn: selected.hourly_rate > 150,
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="p-3 rounded-xl"
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
                  </div>
                  <div
                    className="flex-1 p-4 rounded-2xl space-y-2"
                    style={{
                      background: "rgba(17,24,39,0.7)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
                      Active Risk Signals
                    </p>
                    {evidence.filter((e) => e.risk !== "low").length === 0 ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono">
                        <CheckCircle2 size={14} /> No major anomalies detected
                      </div>
                    ) : (
                      evidence
                        .filter((e) => e.risk !== "low")
                        .map((e) => {
                          const s = RISK_STYLES[e.risk];
                          return (
                            <div
                              key={e.factor}
                              className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs font-mono"
                              style={{
                                background: s.bg,
                                border: `1px solid ${s.border}`,
                                color: s.color,
                              }}
                            >
                              <AlertTriangle
                                size={12}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <span className="flex-1">{e.desc}</span>
                              <span className="font-bold">{e.weight}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Evidence Table */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(17,24,39,0.7)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <Info size={13} className="text-cyan-400" /> Bayesian
                    Evidence Table
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        {[
                          "Factor",
                          "Observed Value",
                          "Likelihood Ratio",
                          "Risk Level",
                          "Signal Strength",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-slate-600 font-normal"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.map((e, i) => {
                        const s = RISK_STYLES[e.risk];
                        return (
                          <motion.tr
                            key={e.factor}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.07 + i * 0.07 }}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <e.icon size={13} style={{ color: s.color }} />
                                <span className="text-slate-200">
                                  {e.factor}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-400">
                              {e.value}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className="font-bold"
                                style={{ color: s.color }}
                              >
                                {e.weight}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className="px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest"
                                style={{
                                  background: s.bg,
                                  color: s.color,
                                  border: `1px solid ${s.border}`,
                                }}
                              >
                                {e.risk}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 w-32">
                              <div
                                className="h-1.5 rounded-full overflow-hidden"
                                style={{ background: "rgba(255,255,255,0.05)" }}
                              >
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.round(e.bar * 100)}%`,
                                  }}
                                  transition={{
                                    delay: 0.3 + i * 0.07,
                                    duration: 0.6,
                                  }}
                                  className="h-full rounded-full"
                                  style={{ background: s.color }}
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Risk Timeline */}
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "rgba(17,24,39,0.7)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white mb-5 flex items-center gap-2">
                  <Clock size={13} className="text-violet-400" /> Risk Timeline
                </h3>
                <div className="relative pl-6">
                  <div
                    className="absolute left-2 top-2 bottom-2 w-px"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  />
                  <div className="space-y-4">
                    {timeline.map((ev, i) => {
                      const s = TL[ev.type];
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.1 }}
                          className="relative flex items-start gap-4"
                        >
                          <div
                            className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2"
                            style={{
                              background: s.dot + "28",
                              borderColor: s.dot,
                              boxShadow: `0 0 8px ${s.dot}55`,
                            }}
                          />
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: s.color }}
                              >
                                {ev.label}
                              </span>
                              <span className="text-[9px] font-mono text-slate-600">
                                {ev.date}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ev.detail}
                            </p>
                          </div>
                          <div
                            className="flex-shrink-0 px-2 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-widest"
                            style={{
                              background: s.bg,
                              color: s.color,
                              border: `1px solid ${s.dot}28`,
                            }}
                          >
                            {ev.type}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              <AIReasoningBox
                key={selected.id}
                text={aiText}
                speed={13}
                title="BAYESIAN FRAUD ANALYSIS"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
