"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FolderOpen, Plus, Clock, Users, DollarSign, Search, ChevronDown, X, CheckCircle2, Cpu, Star, ArrowRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ALL_SKILLS } from "@/data/mockData";
import { listProjects, listFreelancers, enrichFreelancer } from "@/lib/api";

const STATUS_CFG: Record<string, { label: string; colorVar: string; rgbVar: string }> = {
  open: { label: "Open", colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
  in_progress: { label: "In Progress", colorVar: "var(--color-primary)", rgbVar: "var(--color-primary-rgb)" },
  completed: { label: "Completed", colorVar: "var(--color-secondary)", rgbVar: "var(--color-secondary-rgb)" },
};

const PRIORITY_CFG: Record<string, { label: string; colorVar: string }> = {
  high: { label: "High", colorVar: "var(--color-danger)" },
  medium: { label: "Medium", colorVar: "var(--color-warning)" },
  low: { label: "Low", colorVar: "var(--text-subtle)" },
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--text-subtle)" }}>
        {label}{required && <span style={{ color: "var(--color-danger)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function NewProjectModal({ onClose, onSave }: { onClose: () => void; onSave: (p: any) => void }) {
  const [form, setForm] = useState({ title: "", description: "", client: "", budget: 10000, deadline_days: 30, team_size: 2, required_skills: [] as string[], status: "open", priority: "medium" });
  const [skillInput, setSkillInput] = useState("");
  const [step, setStep] = useState(1);
  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const addSkill = (s?: string) => { const sk = s || skillInput.trim(); if (sk && !form.required_skills.includes(sk)) upd("required_skills", [...form.required_skills, sk]); setSkillInput(""); };
  const rmSkill = (s: string) => upd("required_skills", form.required_skills.filter((x) => x !== s));
  const submit = () => { if (!form.title.trim()) return; onSave({ ...form, id: Date.now(), created: new Date().toISOString().split("T")[0], team_members: [] }); onClose(); };

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors";
  const inputStyle = { background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 28, stiffness: 360 }}
        className="w-full max-w-xl rounded-3xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: `1px solid rgba(var(--border-base), 0.1)` }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--border-base), 0.06)` }}>
          <div>
            <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>New Project</h2>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="transition-colors p-1 rounded-lg" style={{ color: "var(--text-subtle)" }}><X size={18} /></button>
        </div>
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.06)` }}>
              <motion.div animate={{ width: step >= s ? "100%" : "0%" }} transition={{ duration: 0.35 }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }} />
            </div>
          ))}
        </div>
        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-4">
                <Field label="Project Title" required><input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. AI Analytics Platform" className={inputCls} style={inputStyle} /></Field>
                <Field label="Client"><input value={form.client} onChange={(e) => upd("client", e.target.value)} placeholder="Client or company name" className={inputCls} style={inputStyle} /></Field>
                <Field label="Description"><textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="Describe the project scope..." rows={3} className={inputCls + " resize-none"} style={inputStyle} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Status">
                    <select value={form.status} onChange={(e) => upd("status", e.target.value)} className={inputCls} style={{ ...inputStyle, background: `rgba(var(--bg-secondary-rgb), 0.95)` }}>
                      <option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select value={form.priority} onChange={(e) => upd("priority", e.target.value)} className={inputCls} style={{ ...inputStyle, background: `rgba(var(--bg-secondary-rgb), 0.95)` }}>
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </Field>
                </div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Budget ($)"><input type="number" value={form.budget} onChange={(e) => upd("budget", +e.target.value)} className={inputCls} style={inputStyle} /></Field>
                  <Field label="Deadline (days)"><input type="number" value={form.deadline_days} onChange={(e) => upd("deadline_days", +e.target.value)} className={inputCls} style={inputStyle} /></Field>
                  <Field label="Team Size">
                    <select value={form.team_size} onChange={(e) => upd("team_size", +e.target.value)} className={inputCls} style={{ ...inputStyle, background: `rgba(var(--bg-secondary-rgb), 0.95)` }}>
                      {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Required Skills">
                  <div className="flex gap-2 mb-2">
                    <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSkill()} placeholder="Type skill + Enter" className={inputCls + " flex-1"} style={inputStyle} />
                    <button onClick={() => addSkill()} className="px-3 py-2.5 rounded-xl transition-colors" style={{ background: `rgba(var(--border-base), 0.06)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-muted)" }}><Plus size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ALL_SKILLS.filter((s) => !form.required_skills.includes(s)).slice(0, 8).map((s) => (
                      <button key={s} onClick={() => addSkill(s)} className="px-2 py-1 rounded-md text-[10px] font-mono transition-colors" style={{ background: `rgba(var(--border-base), 0.03)`, border: `1px solid rgba(var(--border-base), 0.07)`, color: "var(--text-subtle)" }}>+ {s}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {form.required_skills.map((s) => (
                      <span key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono" style={{ background: `rgba(var(--color-primary-rgb), 0.1)`, border: `1px solid rgba(var(--color-primary-rgb), 0.25)`, color: "var(--color-primary)" }}>
                        {s}<button onClick={() => rmSkill(s)} className="transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.6)` }}><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          <button onClick={step === 1 ? onClose : () => setStep(1)} className="px-4 py-2.5 rounded-xl text-xs font-mono transition-colors" style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}>
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step === 1 ? (
            <button onClick={() => form.title.trim() && setStep(2)} disabled={!form.title.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white disabled:opacity-40" style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
              Next <ArrowRight size={13} />
            </button>
          ) : (
            <button onClick={submit} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white" style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
              <CheckCircle2 size={13} /> Create
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ExpandedRow({ project, freelancerMap }: { project: any; freelancerMap: Record<number, any> }) {
  const members = (project.team_members ?? []).map((id: number) => freelancerMap[id]).filter(Boolean);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
      style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)`, overflow: "hidden" }}
    >
      <div className="px-5 pb-5 pt-4 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Assigned Team ({members.length} / {project.team_size})</p>
        {members.length === 0 ? (
          <div className="flex items-center gap-3 py-2">
            <Cpu size={13} style={{ color: "var(--text-subtle)" }} />
            <p className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>No team assigned yet</p>
            <a href="/team-builder" className="ml-auto text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.7)` }}>Build Team →</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {members.map((f: any) => (
              <a key={f.id} href={`/profile/${f.id}`} className="flex items-center gap-2.5 p-2.5 rounded-xl transition-colors group" style={{ border: `1px solid rgba(var(--border-base), 0.06)` }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = `rgba(var(--border-base), 0.05)`)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "")}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0" style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.15), rgba(var(--color-secondary-rgb),0.15))`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-primary)" }}>
                  {f.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate transition-colors" style={{ color: "var(--text-primary)" }}>{f.name}</div>
                  <div className="text-[9px] font-mono flex items-center gap-1 mt-0.5" style={{ color: "var(--text-subtle)" }}>
                    <Star size={8} className="text-yellow-400" /> {Number(f.rating).toFixed(1)} · ${f.hourly_rate}/hr
                  </div>
                </div>
              </a>
            ))}
            {Array.from({ length: Math.max(0, project.team_size - members.length) }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ border: `1px dashed rgba(var(--border-base), 0.07)` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ border: `1px dashed rgba(var(--border-base), 0.08)` }}>
                  <Users size={12} style={{ color: "var(--text-muted)" }} />
                </div>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Open slot</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [freelancerMap, setFreelancerMap] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState("created");

  useEffect(() => {
    Promise.all([listProjects(), listFreelancers({ limit: 200 })]).then(([projRes, flRes]) => {
      setProjects(projRes.projects || []);
      const map: Record<number, any> = {};
      (flRes.freelancers || []).forEach((row: any) => { map[row.id] = enrichFreelancer(row); });
      setFreelancerMap(map);
    }).catch(() => setProjects([])).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: projects.length,
    open: projects.filter((p) => p.status === "open").length,
    in_progress: projects.filter((p) => p.status === "in_progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
  }), [projects]);

  const filtered = useMemo(() => projects.filter((p) => {
    const q = search.toLowerCase();
    return (filter === "all" || p.status === filter) && (priorityFilter === "all" || p.priority === priorityFilter) && (!q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q) || p.required_skills.some((s: string) => s.toLowerCase().includes(q)));
  }).sort((a, b) => sortBy === "budget" ? b.budget - a.budget : sortBy === "deadline" ? a.deadline_days - b.deadline_days : new Date(b.created).getTime() - new Date(a.created).getTime()), [projects, filter, priorityFilter, search, sortBy]);

  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.07)` };
  const inputStyle = { background: `rgba(var(--bg-secondary-rgb), 0.8)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-primary)" };

  return (
    <AppLayout title="Projects">
      <div className="space-y-6 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <FolderOpen size={20} style={{ color: "var(--color-primary)" }} /> Projects
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-subtle)" }}>{projects.length} total · {counts.open} open · {counts.in_progress} in progress</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono font-bold text-xs text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
            <Plus size={14} /> New Project
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-subtle)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, client, skill..." className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-colors font-mono" style={inputStyle} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: `rgba(var(--border-base), 0.04)` }}>
              {["all", "open", "in_progress", "completed"].map((s) => {
                const cfg = STATUS_CFG[s];
                return (
                  <button key={s} onClick={() => setFilter(s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all"
                    style={filter === s ? { background: `rgba(${cfg?.rgbVar ?? "var(--color-primary-rgb)"}, 0.1)`, color: cfg?.colorVar ?? "var(--color-primary)", border: `1px solid rgba(${cfg?.rgbVar ?? "var(--color-primary-rgb)"}, 0.25)` } : { color: "var(--text-subtle)" }}>
                    {s.replace("_", " ")} <span className="font-bold">{counts[s as keyof typeof counts] ?? projects.length}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: `rgba(var(--border-base), 0.04)` }}>
              {["all", "high", "medium", "low"].map((p) => (
                <button key={p} onClick={() => setPriorityFilter(p)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all"
                  style={priorityFilter === p ? { background: `rgba(var(--border-base), 0.08)`, color: PRIORITY_CFG[p]?.colorVar ?? "var(--color-primary)" } : { color: "var(--text-subtle)" }}>
                  {p}
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ml-auto px-3 py-2 rounded-xl text-[10px] font-mono focus:outline-none" style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}>
              <option value="created">Newest</option><option value="budget">Budget ↓</option><option value="deadline">Deadline ↑</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(var(--border-base), 0.07)` }}>
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-mono uppercase tracking-widest" style={{ background: `rgba(var(--border-base), 0.03)`, borderBottom: `1px solid rgba(var(--border-base), 0.06)`, color: "var(--text-subtle)" }}>
            <div className="col-span-4">Project</div><div className="col-span-2">Status</div><div className="col-span-2">Budget</div><div className="col-span-2">Timeline</div><div className="col-span-1">Team</div><div className="col-span-1" />
          </div>

          <AnimatePresence initial={false}>
            {filtered.map((p, i) => {
              const sc = STATUS_CFG[p.status] ?? STATUS_CFG.open;
              const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.medium;
              const isExp = expandedId === p.id;
              const filled = (p.team_members ?? []).length;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ background: isExp ? `rgba(var(--color-primary-rgb), 0.025)` : `rgba(var(--bg-secondary-rgb), 0.55)`, borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 transition-colors cursor-pointer group" onClick={() => setExpandedId(isExp ? null : p.id)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = `rgba(var(--border-base), 0.02)`)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "")}>
                    <div className="md:col-span-4 flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{p.title}</h3>
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: pc.colorVar }}>● {pc.label}</span>
                      </div>
                      {p.client && <span className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>{p.client}</span>}
                      <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{p.description}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.required_skills.slice(0, 3).map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.07)`, color: "var(--text-muted)" }}>{s}</span>
                        ))}
                        {p.required_skills.length > 3 && <span className="text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>+{p.required_skills.length - 3}</span>}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex md:items-center">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest" style={{ background: `rgba(${sc.rgbVar}, 0.1)`, color: sc.colorVar, border: `1px solid rgba(${sc.rgbVar}, 0.25)` }}>{sc.label}</span>
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-center">
                      <div className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>${p.budget.toLocaleString()}</div>
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>total budget</div>
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 font-mono text-sm" style={{ color: "var(--text-primary)" }}><Clock size={12} style={{ color: "var(--text-subtle)" }} /> {p.deadline_days}d</div>
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>{p.created}</div>
                    </div>
                    <div className="md:col-span-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5"><Users size={12} style={{ color: "var(--text-subtle)" }} /><span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>{filled}/{p.team_size}</span></div>
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.06)` }}>
                        <div className="h-full rounded-full" style={{ width: `${(filled / p.team_size) * 100}%`, background: filled >= p.team_size ? "var(--color-success)" : "var(--color-primary)" }} />
                      </div>
                    </div>
                    <div className="md:col-span-1 flex md:items-center md:justify-end">
                      <motion.div animate={{ rotate: isExp ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={16} style={{ color: isExp ? "var(--color-primary)" : "var(--text-subtle)" }} />
                      </motion.div>
                    </div>
                  </div>
                  <AnimatePresence>{isExp && <ExpandedRow project={p} freelancerMap={freelancerMap} />}</AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ background: `rgba(var(--bg-secondary-rgb), 0.4)` }}>
              <FolderOpen size={32} style={{ color: "var(--text-muted)" }} />
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>No projects found</p>
              <button onClick={() => { setFilter("all"); setPriorityFilter("all"); setSearch(""); }} className="text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.7)` }}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
          <span>Showing {filtered.length} of {projects.length} projects</span>
          <span className="ml-auto">Pipeline: ${projects.reduce((s, p) => s + p.budget, 0).toLocaleString()}</span>
        </div>
      </div>

      <AnimatePresence>
        {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSave={(p) => setProjects((prev) => [p, ...prev])} />}
      </AnimatePresence>
    </AppLayout>
  );
}
