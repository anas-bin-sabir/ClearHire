"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Users, Cpu, CheckCircle2, AlertCircle, DollarSign, Calendar, TrendingUp, Shield, Star, MapPin, Clock, Zap } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import AIReasoningBox from "@/components/AIReasoningBox";
import { ALL_SKILLS } from "@/data/mockData";
import { buildTeam, enrichFreelancer } from "@/lib/api";

const SOLVE_STEPS = [
  { label: "Scanning freelancer pool", detail: "Loading 20 candidates into working set..." },
  { label: "Applying constraints", detail: "Budget, availability, and fraud filters active..." },
  { label: "Running CSP backtracking", detail: "Forward checking with MRV heuristic..." },
  { label: "Optimising selection", detail: "Minimising cost, maximising skill coverage..." },
];

export default function TeamBuilderPage() {
  const [constraints, setConstraints] = useState({ budget: 15000, deadline_days: 30, team_size: 3, required_skills: ["React", "Python"] });
  const [skillInput, setSkillInput] = useState("");
  const [solving, setSolving] = useState(false);
  const [solveStep, setSolveStep] = useState(-1);
  const [result, setResult] = useState<any>(null);
  const [aiText, setAiText] = useState("");

  const addSkill = (s?: string) => {
    const skill = s || skillInput.trim();
    if (skill && !constraints.required_skills.includes(skill)) setConstraints((p) => ({ ...p, required_skills: [...p.required_skills, skill] }));
    setSkillInput("");
  };
  const removeSkill = (s: string) => setConstraints((p) => ({ ...p, required_skills: p.required_skills.filter((x) => x !== s) }));

  const handleBuild = async () => {
    setSolving(true);
    setSolveStep(0);
    setResult(null);
    setAiText("");
    for (let i = 0; i < SOLVE_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 400));
      setSolveStep(i + 1);
    }
    await new Promise((r) => setTimeout(r, 400));
    try {
      const apiRes = await buildTeam({ budget: constraints.budget, required_skills: constraints.required_skills, team_size: constraints.team_size, hours_per_member: 40, max_fraud_score: 0.6 });
      const team = (apiRes.team || []).map(enrichFreelancer);
      const skillsCovered = constraints.required_skills.filter((s) => team.some((f: any) => f.skills?.includes(s)));
      setResult({ success: apiRes.success, team, total_cost: apiRes.total_cost, skills_covered: skillsCovered, uncovered_skills: constraints.required_skills.filter((s) => !skillsCovered.includes(s)) });
      setAiText(apiRes.explanation || (apiRes.success ? "CSP solver found a valid team within your constraints." : apiRes.message || "No feasible team within constraints."));
    } catch {
      setResult({ success: false, team: [], total_cost: 0, skills_covered: [], uncovered_skills: constraints.required_skills });
      setAiText("Team builder request failed. Ensure the API is running on port 8000.");
    }
    setSolving(false);
  };

  const budgetPct = result ? Math.round(Math.min(result.total_cost / constraints.budget, 1) * 100) : 0;
  const inputStyle = { background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" };
  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.05)` };

  return (
    <AppLayout title="Team Builder">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
        {/* Left: Constraint Form */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Cpu size={20} style={{ color: "var(--color-secondary)" }} /> CSP Solver
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-subtle)" }}>
              Define constraints — the backtracking solver finds the optimal team composition.
            </p>
          </div>

          <div className="space-y-5 p-6 rounded-2xl" style={cardStyle}>
            {/* Budget */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
                  <DollarSign size={11} /> Total Budget
                </label>
                <span className="font-mono text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                  ${constraints.budget.toLocaleString()}
                </span>
              </div>
              <input type="range" min="1000" max="50000" step="500" value={constraints.budget} onChange={(e) => setConstraints((p) => ({ ...p, budget: +e.target.value }))} className="w-full" />
              <div className="flex justify-between text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>
                <span>$1,000</span><span>$50,000</span>
              </div>
            </div>

            {/* Deadline + Size */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
                  <Calendar size={11} /> Deadline (days)
                </label>
                <input type="number" min="7" max="365" value={constraints.deadline_days} onChange={(e) => setConstraints((p) => ({ ...p, deadline_days: +e.target.value }))} className="w-full rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" style={inputStyle} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
                  <Users size={11} /> Team Size
                </label>
                <select value={constraints.team_size} onChange={(e) => setConstraints((p) => ({ ...p, team_size: +e.target.value }))} className="w-full rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" style={{ ...inputStyle, background: `rgba(var(--bg-secondary-rgb), 0.95)` }}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} member{n !== 1 ? "s" : ""}</option>)}
                </select>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
                <TrendingUp size={11} /> Required Skills
              </label>
              <div className="flex gap-2">
                <input type="text" placeholder="Type a skill + Enter..." value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSkill()} className="flex-1 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none" style={inputStyle} />
                <button onClick={() => addSkill()} className="px-3 py-2.5 rounded-xl transition-colors" style={{ background: `rgba(var(--border-base), 0.06)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-muted)" }}>
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SKILLS.filter((s) => !constraints.required_skills.includes(s)).slice(0, 8).map((s) => (
                  <button key={s} onClick={() => addSkill(s)} className="px-2 py-1 rounded-md text-[10px] font-mono transition-colors" style={{ background: `rgba(var(--border-base), 0.03)`, border: `1px solid rgba(var(--border-base), 0.06)`, color: "var(--text-subtle)" }}>
                    + {s}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {constraints.required_skills.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1.5 pt-1">
                    {constraints.required_skills.map((s) => (
                      <motion.span key={s} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono"
                        style={{ background: `rgba(var(--color-primary-rgb), 0.1)`, border: `1px solid rgba(var(--color-primary-rgb), 0.25)`, color: "var(--color-primary)" }}
                      >
                        {s}
                        <button onClick={() => removeSkill(s)} className="transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.6)` }}>
                          <X size={10} />
                        </button>
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CTA */}
            <button
              onClick={handleBuild} disabled={solving}
              className="w-full py-3.5 rounded-xl font-mono font-bold text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all disabled:opacity-70"
              style={{ background: solving ? `rgba(var(--color-primary-rgb), 0.4)` : `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}
            >
              {solving ? (
                <><Cpu size={18} style={{ animation: "tbspin 1s linear infinite" }} /> Solving CSP...</>
              ) : (
                <><Zap size={18} /> Build Optimal Team</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-7 space-y-5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--text-subtle)" }}>Optimisation Output</h3>

          <AnimatePresence>
            {solving && (
              <motion.div key="steps" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="p-5 rounded-2xl space-y-4"
                style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--color-secondary-rgb), 0.2)` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={14} style={{ color: "var(--color-secondary)", animation: "tbspin 1.2s linear infinite" }} />
                  <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--color-secondary)" }}>CSP Backtracking Running...</span>
                </div>
                {SOLVE_STEPS.map((step, i) => {
                  const done = solveStep > i;
                  const active = solveStep === i;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: done ? `rgba(var(--color-success-rgb), 0.15)` : active ? `rgba(var(--color-secondary-rgb), 0.15)` : `rgba(var(--border-base), 0.04)`,
                          border: `1px solid ${done ? `rgba(var(--color-success-rgb), 0.3)` : active ? `rgba(var(--color-secondary-rgb), 0.3)` : `rgba(var(--border-base), 0.08)`}`,
                        }}
                      >
                        {done ? <CheckCircle2 size={12} style={{ color: "var(--color-success)" }} /> : active ? <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-secondary)", animation: "tbpulse 0.8s ease-in-out infinite" }} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }} />}
                      </div>
                      <div>
                        <p className="text-xs font-mono" style={{ color: done ? "var(--color-success)" : active ? "var(--color-secondary)" : "var(--text-subtle)" }}>{step.label}</p>
                        {(done || active) && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-subtle)" }}>{step.detail}</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && !solving && (
              <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {result.success ? (
                  <>
                    <div className="p-5 rounded-2xl space-y-4" style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid ${budgetPct > 100 ? `rgba(var(--color-danger-rgb), 0.2)` : `rgba(var(--color-primary-rgb), 0.15)`}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />
                          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>Solution Found</span>
                        </div>
                        <span className="text-xs font-mono font-bold" style={{ color: budgetPct > 100 ? "var(--color-danger)" : "var(--color-success)" }}>{budgetPct}% of budget</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-mono mb-1.5" style={{ color: "var(--text-subtle)" }}>
                          <span>Budget utilisation</span>
                          <span>${result.total_cost.toLocaleString()} / ${constraints.budget.toLocaleString()}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.06)` }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(budgetPct, 100)}%` }} transition={{ delay: 0.2, duration: 0.9 }} className="h-full rounded-full"
                            style={{ background: budgetPct > 100 ? "var(--color-danger)" : budgetPct > 85 ? "var(--color-warning)" : `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }} />
                        </div>
                      </div>
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Skill Coverage</p>
                        <div className="flex flex-wrap gap-1.5">
                          {constraints.required_skills.map((s) => {
                            const covered = result.skills_covered.includes(s);
                            return (
                              <span key={s} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono"
                                style={covered ? { background: `rgba(var(--color-success-rgb), 0.1)`, color: "var(--color-success)", border: `1px solid rgba(var(--color-success-rgb), 0.2)` } : { background: `rgba(var(--color-danger-rgb), 0.1)`, color: "var(--color-danger)", border: `1px solid rgba(var(--color-danger-rgb), 0.2)` }}>
                                {covered ? <CheckCircle2 size={9} /> : <X size={9} />} {s}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.team.map((f: any, i: number) => (
                        <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                          className="p-4 rounded-2xl flex gap-3"
                          style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` }}
                        >
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.18), rgba(var(--color-secondary-rgb),0.18))`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-primary)" }}>
                            {f.avatar || f.name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{f.name}</h4>
                              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--color-primary)" }}>${f.hourly_rate}/hr</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
                              <Star size={9} className="text-yellow-400 fill-yellow-400" /> {Number(f.rating).toFixed(1)}
                              <span>·</span><Clock size={9} /> {f.experience_years}y
                              {f.location && <><span>·</span><MapPin size={9} /> {f.location.split(",")[0]}</>}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {f.skills.slice(0, 3).map((s: string) => (
                                <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.07)`, color: "var(--text-muted)" }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <AIReasoningBox key={JSON.stringify(constraints)} text={aiText} speed={12} title="CSP SOLVER REASONING" />
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 rounded-2xl gap-4 text-center"
                    style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)` }}
                  >
                    <AlertCircle size={36} style={{ color: "var(--color-danger)" }} />
                    <div>
                      <h4 className="font-mono font-bold mb-1" style={{ color: "var(--text-primary)" }}>CONSTRAINT CONFLICT</h4>
                      <p className="text-sm max-w-xs" style={{ color: "var(--text-subtle)" }}>{aiText || "No valid team configuration found. Try increasing budget or reducing required skills."}</p>
                    </div>
                    <button onClick={handleBuild} className="px-6 py-2 rounded-xl text-[11px] font-mono uppercase tracking-widest transition-colors" style={{ border: `1px solid rgba(var(--color-danger-rgb), 0.2)`, color: "var(--color-danger)" }}>
                      Retry with new constraints
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!solving && !result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 rounded-2xl gap-4"
              style={{ border: `2px dashed rgba(var(--border-base), 0.06)` }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `rgba(var(--border-base), 0.04)`, border: `1px solid rgba(var(--border-base), 0.08)` }}>
                <Users size={28} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="text-center">
                <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Awaiting simulation parameters</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Configure constraints and click Build Team</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tbspin { to { transform: rotate(360deg); } }
        @keyframes tbpulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
      `}</style>
    </AppLayout>
  );
}
