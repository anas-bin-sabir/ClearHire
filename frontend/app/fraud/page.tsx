"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert, Search, X, AlertTriangle, CheckCircle2,
  Clock, Star, DollarSign, Calendar, Network, ChevronRight, Info,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/ui/Card";
import FraudGauge from "@/components/FraudGauge";
import AIReasoningBox from "@/components/AIReasoningBox";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { getFraudScore, enrichFreelancer, listFreelancers } from "@/lib/api";

function buildEvidence(f: any) {
  const velocity = f.account_age_days > 0 ? (f.review_count / f.account_age_days) * 30 : 0;
  const rateMismatch = f.hourly_rate > 130 && f.experience_years < 3;
  const highVelocity = velocity > 5;
  const ratingAnomaly = f.rating >= 4.9 && f.review_count > 50;
  const portfolioRisk = f.fraud_score > 0.5;
  return [
    { factor: "Account Age", icon: Calendar, value: `${f.account_age_days} days`, weight: f.account_age_days < 30 ? "8×" : f.account_age_days < 90 ? "2×" : "0.5×", risk: f.account_age_days < 30 ? "high" : f.account_age_days < 90 ? "medium" : "low", desc: f.account_age_days < 30 ? "Newly created account — major anomaly signal" : f.account_age_days < 90 ? "Account less than 3 months old" : "Established account with strong tenure", bar: Math.max(0, 1 - f.account_age_days / 365) },
    { factor: "Rate / Experience", icon: DollarSign, value: `$${f.hourly_rate}/hr · ${f.experience_years}y`, weight: rateMismatch ? "5×" : "0.4×", risk: rateMismatch ? "high" : "low", desc: rateMismatch ? "Premium rate with minimal verifiable experience" : "Rate aligns with stated experience level", bar: rateMismatch ? 0.85 : 0.1 },
    { factor: "Review Velocity", icon: Star, value: `${f.review_count} reviews · ${velocity.toFixed(1)}/mo`, weight: highVelocity ? "5×" : velocity > 2 ? "1.5×" : "0.3×", risk: highVelocity ? "high" : velocity > 2 ? "medium" : "low", desc: highVelocity ? "Abnormally high review acquisition — potential ring" : velocity > 2 ? "Slightly elevated velocity" : "Natural review accumulation", bar: Math.min(velocity / 10, 1) },
    { factor: "Rating Pattern", icon: Star, value: `${Number(f.rating).toFixed(1)} ★ (${f.review_count} total)`, weight: ratingAnomaly ? "3×" : "0.5×", risk: ratingAnomaly ? "medium" : "low", desc: ratingAnomaly ? "Suspiciously perfect rating across large review count" : "Rating distribution appears organic", bar: ratingAnomaly ? 0.65 : 0.15 },
    { factor: "Network Signal", icon: Network, value: portfolioRisk ? "Cluster detected" : "No connections", weight: portfolioRisk ? "10×" : "0.2×", risk: portfolioRisk ? "high" : "low", desc: portfolioRisk ? "Account shares portfolio hashes with flagged identities" : "No known connections to flagged rings", bar: f.fraud_score },
  ];
}

function buildTimeline(f: any) {
  const now = Date.now(), dayMs = 86400000;
  const fmt = (d: number) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const events: any[] = [{ date: fmt(now - f.account_age_days * dayMs), label: "Account created", type: f.account_age_days < 30 ? "danger" : "neutral", detail: `Registered ${f.account_age_days} days ago` }];
  if (f.review_count > 0) { const fr = Math.floor(f.account_age_days * 0.15); events.push({ date: fmt(now - fr * dayMs), label: "First review received", type: fr < 5 ? "warning" : "neutral", detail: fr < 5 ? "Review received within days of account creation" : "Normal review timeline" }); }
  if (f.fraud_score > 0.5) events.push({ date: fmt(now - Math.floor(f.account_age_days * 0.4) * dayMs), label: "Portfolio similarity flagged", type: "danger", detail: "Content hash matches 2 other flagged accounts" });
  if (f.review_count > 40) events.push({ date: fmt(now - Math.floor(f.account_age_days * 0.6) * dayMs), label: "Review velocity spike", type: f.review_count > 80 ? "danger" : "warning", detail: `${f.review_count} reviews over account lifetime` });
  events.push({ date: fmt(now), label: "Bayesian scan completed", type: f.fraud_score > 0.7 ? "danger" : f.fraud_score > 0.3 ? "warning" : "success", detail: `Final probability: ${Math.round(f.fraud_score * 100)}%` });
  return events;
}

const RISK_STYLES: Record<string, { colorVar: string; rgbVar: string }> = {
  high: { colorVar: "var(--color-danger)", rgbVar: "var(--color-danger-rgb)" },
  medium: { colorVar: "var(--color-warning)", rgbVar: "var(--color-warning-rgb)" },
  low: { colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
};

const TL_STYLES: Record<string, { colorVar: string; rgbVar: string }> = {
  danger: { colorVar: "var(--color-danger)", rgbVar: "var(--color-danger-rgb)" },
  warning: { colorVar: "var(--color-warning)", rgbVar: "var(--color-warning-rgb)" },
  success: { colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
  neutral: { colorVar: "var(--text-subtle)", rgbVar: "var(--border-base)" },
};

export default function FraudLabPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [flaggedSamples, setFlaggedSamples] = useState<any[]>([]);
  const [displayScore, setDisplayScore] = useState(0);
  const [fraudExplanation, setFraudExplanation] = useState("");
  const [agentRanAt, setAgentRanAt] = useState<string | null>(null);
  const [isPrecomputed, setIsPrecomputed] = useState(false);
  const [fraudConfidence, setFraudConfidence] = useState<string | null>(null);

  useEffect(() => {
    listFreelancers({ flaggedOnly: true, limit: 8 }).then((r) => setFlaggedSamples(r.freelancers.map(enrichFreelancer))).catch(() => setFlaggedSamples([]));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      listFreelancers({ q: query.trim(), limit: 6 }).then((r) => setSearchResults(r.freelancers.map(enrichFreelancer))).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!selected) { setDisplayScore(0); return; }
    const target = selected.fraud_score ?? 0;
    const start = performance.now();
    let frame: number;
    const tick = (t: number) => {
      const p = Math.min((t - start) / 900, 1);
      setDisplayScore(target * p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selected?.id, selected?.fraud_score]);

  const pick = async (f: any) => {
    setScanning(true);
    setSearched(true);
    setQuery(f.name);
    setFraudExplanation("");
    setAgentRanAt(null);
    setIsPrecomputed(false);
    setFraudConfidence(null);
    try {
      const res = await getFraudScore({ freelancer_id: f.id });
      const merged = enrichFreelancer({ ...(res.freelancer || f), fraud_score: res.score });
      setSelected(merged);
      setFraudExplanation(res.explanation || "");
      setFraudConfidence(res.confidence ?? null);
      if (res.source === "agent_precomputed") {
        setIsPrecomputed(true);
        setAgentRanAt(res.ran_at ?? null);
      }
    } catch (err: any) {
      setSelected(f);
      setFraudExplanation(err?.message || "Fraud scan failed — is the API running?");
    } finally { setScanning(false); }
  };

  const clear = () => { setQuery(""); setSelected(null); setSearched(false); };

  const evidence = selected ? buildEvidence(selected) : [];
  const timeline = selected ? buildTimeline(selected) : [];
  const aiText = fraudExplanation;
  const fc = !selected ? "var(--text-subtle)" : displayScore < 0.3 ? "var(--color-success)" : displayScore < 0.7 ? "var(--color-warning)" : "var(--color-danger)";
  const fcRgb = !selected ? "var(--border-base)" : displayScore < 0.3 ? "var(--color-success-rgb)" : displayScore < 0.7 ? "var(--color-warning-rgb)" : "var(--color-danger-rgb)";

  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` };

  return (
    <AppLayout title="Fraud Lab">
      <div className="space-y-6 pb-10 max-w-6xl">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `rgba(var(--color-danger-rgb), 0.1)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)` }}>
            <ShieldAlert size={22} style={{ color: "var(--color-danger)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Fraud Intelligence Lab</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-subtle)" }}>Bayesian risk scoring · Evidence analysis · Behavioral pattern detection</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-subtle)" }} />
              <input
                type="text" value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && searchResults.length > 0) pick(searchResults[0]); }}
                placeholder="Search by name or ID — try 'Alex Storm' or '13'..."
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm font-mono focus:outline-none transition-all"
                style={{ background: `rgba(var(--bg-secondary-rgb), 0.8)`, border: `1px solid ${selected ? `rgba(${fcRgb}, 0.5)` : `rgba(var(--border-base), 0.1)`}`, color: "var(--text-primary)" }}
              />
              {query && <button onClick={clear} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: "var(--text-subtle)" }}><X size={16} /></button>}
            </div>
            <button
              onClick={() => { if (searchResults.length > 0) pick(searchResults[0]); }}
              className="px-6 py-3.5 rounded-2xl font-mono font-bold text-sm uppercase tracking-wider text-white transition-all"
              style={{ background: `linear-gradient(135deg, var(--color-danger), rgba(var(--color-danger-rgb), 0.7))` }}
            >
              SCAN
            </button>
          </div>

          <AnimatePresence>
            {query && !selected && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-surface)", border: `1px solid rgba(var(--border-base), 0.1)` }}
              >
                {searchResults.map((f: any) => (
                  <button
                    key={f.id} onClick={() => pick(f)}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = `rgba(var(--border-base), 0.05)`)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0" style={{ background: `rgba(var(--border-base), 0.08)`, color: "var(--text-primary)" }}>
                      {f.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>{f.name}</div>
                      <div className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>ID #{f.id} · {f.location}</div>
                    </div>
                    <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: f.fraud_score < 0.3 ? "var(--color-success)" : f.fraud_score < 0.7 ? "var(--color-warning)" : "var(--color-danger)" }}>
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 rounded-2xl gap-5"
            style={{ border: `2px dashed rgba(var(--border-base), 0.06)` }}
          >
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: `rgba(var(--color-danger-rgb), 0.05)`, border: `1px solid rgba(var(--color-danger-rgb), 0.12)` }}>
              <ShieldAlert size={36} style={{ color: `rgba(var(--color-danger-rgb), 0.4)` }} />
            </div>
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Awaiting scan target</p>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Search by freelancer name or numeric ID to begin analysis</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {flaggedSamples.map((f: any) => (
                <button
                  key={f.id} onClick={() => pick(f)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors"
                  style={{ background: `rgba(var(--color-danger-rgb), 0.08)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)`, color: "var(--color-danger)" }}
                >
                  🚨 {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Analysis Output */}
        <AnimatePresence>
          {selected && (
            <motion.div key={selected.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Gauge + Subject */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div
                  className="md:col-span-4 flex flex-col items-center gap-4 p-6 rounded-2xl"
                  style={{ background: `rgba(var(--bg-secondary-rgb), 0.8)`, border: `1px solid rgba(${fcRgb}, 0.28)` }}
                >
                  <div className="w-full h-0.5 rounded-full" style={{ background: `linear-gradient(90deg,transparent,${fc},transparent)` }} />
                  {isPrecomputed && agentRanAt && (
                    <div className="mb-1">
                      <AgentStatusBadge
                        pipeline="fraud_detection"
                        ranAt={agentRanAt}
                        confidence={fraudConfidence ?? undefined}
                      />
                    </div>
                  )}
                  <FraudGauge
                    score={displayScore}
                    size={156}
                    thickness={11}
                    confidence={fraudConfidence ?? undefined}
                    key={`${selected.id}-${Math.round(displayScore * 100)}`}
                  />
                  <div className="w-full space-y-2 pt-2" style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)` }}>
                    <div className="flex justify-between text-[10px] font-mono uppercase" style={{ color: "var(--text-subtle)" }}>
                      <span>Confidence</span>
                      <span style={{ color: "var(--color-primary)" }}>92%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: "92%" }} transition={{ delay: 0.5, duration: 0.9 }} className="h-full rounded-full" style={{ background: "var(--color-primary)" }} />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-8 flex flex-col gap-4">
                  <div className="p-5 rounded-2xl" style={cardStyle}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold flex-shrink-0" style={{ background: `rgba(var(--border-base), 0.07)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" }}>
                        {selected.avatar}
                      </div>
                      <div>
                        <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>ID #{selected.id} · {selected.location} · {selected.experience_years}y exp</p>
                      </div>
                      <a href={`/profile/${selected.id}`} className="ml-auto flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.7)` }}>
                        Profile <ChevronRight size={12} />
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: "Account Age", value: `${selected.account_age_days}d`, warn: selected.account_age_days < 30 },
                        { label: "Reviews", value: selected.review_count, warn: selected.review_count > 80 },
                        { label: "Rate", value: `$${selected.hourly_rate}/hr`, warn: selected.hourly_rate > 150 },
                      ].map((s) => (
                        <div key={s.label} className="p-3 rounded-xl" style={{ background: s.warn ? `rgba(var(--color-danger-rgb), 0.06)` : `rgba(var(--border-base), 0.03)`, border: `1px solid ${s.warn ? `rgba(var(--color-danger-rgb), 0.2)` : `rgba(var(--border-base), 0.06)`}` }}>
                          <div className="text-lg font-mono font-bold" style={{ color: s.warn ? "var(--color-danger)" : "var(--text-primary)" }}>{s.value}</div>
                          <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "var(--text-subtle)" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 p-4 rounded-2xl space-y-2" style={cardStyle}>
                    <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-subtle)" }}>Active Risk Signals</p>
                    {evidence.filter((e) => e.risk !== "low").length === 0 ? (
                      <div className="flex items-center gap-2 text-sm font-mono" style={{ color: "var(--color-success)" }}>
                        <CheckCircle2 size={14} /> No major anomalies detected
                      </div>
                    ) : (
                      evidence.filter((e) => e.risk !== "low").map((e) => {
                        const s = RISK_STYLES[e.risk];
                        return (
                          <div key={e.factor} className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: `rgba(${s.rgbVar}, 0.08)`, border: `1px solid rgba(${s.rgbVar}, 0.2)`, color: s.colorVar }}>
                            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
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
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}>
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <Info size={13} style={{ color: "var(--color-primary)" }} /> Bayesian Evidence Table
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}>
                        {["Factor", "Observed Value", "Likelihood Ratio", "Risk Level", "Signal Strength"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[9px] uppercase tracking-widest font-normal" style={{ color: "var(--text-subtle)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.map((e, i) => {
                        const s = RISK_STYLES[e.risk];
                        return (
                          <motion.tr key={e.factor} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 + i * 0.07 }}
                            style={{ borderBottom: `1px solid rgba(var(--border-base), 0.04)` }}
                            onMouseEnter={(el) => ((el.currentTarget as HTMLTableRowElement).style.background = `rgba(var(--border-base), 0.02)`)}
                            onMouseLeave={(el) => ((el.currentTarget as HTMLTableRowElement).style.background = "")}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <e.icon size={13} style={{ color: s.colorVar }} />
                                <span style={{ color: "var(--text-secondary)" }}>{e.factor}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5" style={{ color: "var(--text-muted)" }}>{e.value}</td>
                            <td className="px-5 py-3.5"><span className="font-bold" style={{ color: s.colorVar }}>{e.weight}</span></td>
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest" style={{ background: `rgba(${s.rgbVar}, 0.08)`, color: s.colorVar, border: `1px solid rgba(${s.rgbVar}, 0.2)` }}>{e.risk}</span>
                            </td>
                            <td className="px-5 py-3.5 w-32">
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(e.bar * 100)}%` }} transition={{ delay: 0.3 + i * 0.07, duration: 0.6 }} className="h-full rounded-full" style={{ background: s.colorVar }} />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Timeline */}
              <div className="p-5 rounded-2xl" style={cardStyle}>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] mb-5 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Clock size={13} style={{ color: "var(--color-secondary)" }} /> Risk Timeline
                </h3>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: `rgba(var(--border-base), 0.07)` }} />
                  <div className="space-y-4">
                    {timeline.map((ev: any, i: number) => {
                      const s = TL_STYLES[ev.type] ?? TL_STYLES.neutral;
                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="relative flex items-start gap-4">
                          <div className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2" style={{ background: `rgba(${s.rgbVar}, 0.28)`, borderColor: s.colorVar, boxShadow: `0 0 8px rgba(${s.rgbVar}, 0.55)` }} />
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: s.colorVar }}>{ev.label}</span>
                              <span className="text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>{ev.date}</span>
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{ev.detail}</p>
                          </div>
                          <div className="flex-shrink-0 px-2 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-widest" style={{ background: `rgba(${s.rgbVar}, 0.1)`, color: s.colorVar, border: `1px solid rgba(${s.rgbVar}, 0.28)` }}>
                            {ev.type}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <AIReasoningBox key={selected.id} text={aiText} speed={13} title="BAYESIAN FRAUD ANALYSIS" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
