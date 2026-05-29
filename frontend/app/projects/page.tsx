"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderOpen,
  Plus,
  Clock,
  Users,
  DollarSign,
  Search,
  ChevronDown,
  X,
  CheckCircle2,
  Cpu,
  Star,
  ArrowRight,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ALL_SKILLS } from "@/data/mockData";
import { listProjects, listFreelancers, enrichFreelancer } from "@/lib/api";

const STATUS_CFG = {
  open: {
    label: "Open",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
  },
  in_progress: {
    label: "In Progress",
    color: "#00D4FF",
    bg: "rgba(0,212,255,0.1)",
    border: "rgba(0,212,255,0.25)",
  },
  completed: {
    label: "Completed",
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.1)",
    border: "rgba(124,58,237,0.25)",
  },
};

const PRIORITY_CFG = {
  high: { label: "High", color: "#EF4444" },
  medium: { label: "Medium", color: "#F59E0B" },
  low: { label: "Low", color: "#64748B" },
};

const IC =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono";

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function NewProjectModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    client: "",
    budget: 10000,
    deadline_days: 30,
    team_size: 2,
    required_skills: [],
    status: "open",
    priority: "medium",
  });
  const [skillInput, setSkillInput] = useState("");
  const [step, setStep] = useState(1);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addSkill = (s) => {
    const sk = s || skillInput.trim();
    if (sk && !form.required_skills.includes(sk))
      upd("required_skills", [...form.required_skills, sk]);
    setSkillInput("");
  };
  const rmSkill = (s) =>
    upd(
      "required_skills",
      form.required_skills.filter((x) => x !== s),
    );
  const submit = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      id: Date.now(),
      created: new Date().toISOString().split("T")[0],
      team_members: [],
    });
    onClose();
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 28, stiffness: 360 }}
        className="w-full max-w-xl rounded-3xl overflow-hidden"
        style={{
          background: "#0D1117",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <h2 className="font-bold text-white text-sm">New Project</h2>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              Step {step} of 2
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                animate={{ width: step >= s ? "100%" : "0%" }}
                transition={{ duration: 0.35 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#00D4FF,#7C3AED)" }}
              />
            </div>
          ))}
        </div>
        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="space-y-4"
              >
                <Field label="Project Title" required>
                  <input
                    value={form.title}
                    onChange={(e) => upd("title", e.target.value)}
                    placeholder="e.g. AI Analytics Platform"
                    className={IC}
                  />
                </Field>
                <Field label="Client">
                  <input
                    value={form.client}
                    onChange={(e) => upd("client", e.target.value)}
                    placeholder="Client or company name"
                    className={IC}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => upd("description", e.target.value)}
                    placeholder="Describe the project scope..."
                    rows={3}
                    className={IC + " resize-none"}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => upd("status", e.target.value)}
                      className={IC}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(e) => upd("priority", e.target.value)}
                      className={IC}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </Field>
                </div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Budget ($)">
                    <input
                      type="number"
                      value={form.budget}
                      onChange={(e) => upd("budget", +e.target.value)}
                      className={IC}
                    />
                  </Field>
                  <Field label="Deadline (days)">
                    <input
                      type="number"
                      value={form.deadline_days}
                      onChange={(e) => upd("deadline_days", +e.target.value)}
                      className={IC}
                    />
                  </Field>
                  <Field label="Team Size">
                    <select
                      value={form.team_size}
                      onChange={(e) => upd("team_size", +e.target.value)}
                      className={IC}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Required Skills">
                  <div className="flex gap-2 mb-2">
                    <input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSkill()}
                      placeholder="Type skill + Enter"
                      className={IC + " flex-1"}
                    />
                    <button
                      onClick={() => addSkill()}
                      className="px-3 py-2.5 rounded-xl text-slate-400 hover:text-white transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ALL_SKILLS.filter((s) => !form.required_skills.includes(s))
                      .slice(0, 8)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => addSkill(s)}
                          className="px-2 py-1 rounded-md text-[10px] font-mono text-slate-500 hover:text-cyan-400 transition-colors"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {form.required_skills.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300"
                        style={{
                          background: "rgba(0,212,255,0.1)",
                          border: "1px solid rgba(0,212,255,0.25)",
                        }}
                      >
                        {s}
                        <button
                          onClick={() => rmSkill(s)}
                          className="text-cyan-400/60 hover:text-red-400 transition-colors"
                        >
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-4 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step === 1 ? (
            <button
              onClick={() => form.title.trim() && setStep(2)}
              disabled={!form.title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-black disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#00D4FF,#7C3AED)" }}
            >
              Next <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={submit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-black"
              style={{ background: "linear-gradient(135deg,#00D4FF,#7C3AED)" }}
            >
              <CheckCircle2 size={13} /> Create
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ExpandedRow({ project, freelancerMap }) {
  const members = (project.team_members ?? [])
    .map((id) => freelancerMap[id])
    .filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      <div className="px-5 pb-5 pt-4 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Assigned Team ({members.length} / {project.team_size})
        </p>
        {members.length === 0 ? (
          <div className="flex items-center gap-3 py-2">
            <Cpu size={13} className="text-slate-600" />
            <p className="text-slate-600 text-xs font-mono">
              No team assigned yet
            </p>
            <a
              href="/team-builder"
              className="ml-auto text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors uppercase tracking-widest"
            >
              Build Team →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {members.map((f) => (
              <a
                key={f.id}
                href={`/profile/${f.id}`}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg,rgba(0,212,255,0.15),rgba(124,58,237,0.15))",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {f.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                    {f.name}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                    <Star size={8} className="text-yellow-400" />{" "}
                    {Number(f.rating).toFixed(1)} · ${f.hourly_rate}/hr
                  </div>
                </div>
              </a>
            ))}
            {Array.from({
              length: Math.max(0, project.team_size - members.length),
            }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-2.5 rounded-xl"
                style={{ border: "1px dashed rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
                >
                  <Users size={12} className="text-slate-700" />
                </div>
                <span className="text-[10px] font-mono text-slate-700">
                  Open slot
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [freelancerMap, setFreelancerMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listProjects(), listFreelancers({ limit: 200 })])
      .then(([projRes, flRes]) => {
        setProjects(projRes.projects || []);
        const map = {};
        (flRes.freelancers || []).forEach((row) => {
          map[row.id] = enrichFreelancer(row);
        });
        setFreelancerMap(map);
      })
      .catch(() => {
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState("created");

  const counts = useMemo(
    () => ({
      all: projects.length,
      open: projects.filter((p) => p.status === "open").length,
      in_progress: projects.filter((p) => p.status === "in_progress").length,
      completed: projects.filter((p) => p.status === "completed").length,
    }),
    [projects],
  );

  const filtered = useMemo(
    () =>
      projects
        .filter((p) => {
          const q = search.toLowerCase();
          return (
            (filter === "all" || p.status === filter) &&
            (priorityFilter === "all" || p.priority === priorityFilter) &&
            (!q ||
              p.title.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              (p.client || "").toLowerCase().includes(q) ||
              p.required_skills.some((s) => s.toLowerCase().includes(q)))
          );
        })
        .sort((a, b) =>
          sortBy === "budget"
            ? b.budget - a.budget
            : sortBy === "deadline"
              ? a.deadline_days - b.deadline_days
              : new Date(b.created) - new Date(a.created),
        ),
    [projects, filter, priorityFilter, search, sortBy],
  );

  return (
    <AppLayout title="Projects">
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FolderOpen size={20} className="text-cyan-400" /> Projects
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {projects.length} total · {counts.open} open ·{" "}
              {counts.in_progress} in progress
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono font-bold text-xs text-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#00D4FF,#7C3AED)" }}
          >
            <Plus size={14} /> New Project
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, client, skill..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors font-mono"
              style={{
                background: "rgba(17,24,39,0.8)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {["all", "open", "in_progress", "completed"].map((s) => {
                const cfg = STATUS_CFG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all"
                    style={
                      filter === s
                        ? {
                            background: cfg?.bg ?? "rgba(0,212,255,0.1)",
                            color: cfg?.color ?? "#00D4FF",
                            border: `1px solid ${cfg?.border ?? "rgba(0,212,255,0.25)"}`,
                          }
                        : { color: "#64748B" }
                    }
                  >
                    {s.replace("_", " ")}{" "}
                    <span className="font-bold">
                      {counts[s] ?? projects.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {["all", "high", "medium", "low"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all"
                  style={
                    priorityFilter === p
                      ? {
                          background: "rgba(255,255,255,0.08)",
                          color: PRIORITY_CFG[p]?.color ?? "#00D4FF",
                        }
                      : { color: "#64748B" }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="ml-auto px-3 py-2 rounded-xl text-[10px] font-mono text-slate-400 focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <option value="created">Newest</option>
              <option value="budget">Budget ↓</option>
              <option value="deadline">Deadline ↑</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-mono uppercase tracking-widest text-slate-600"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="col-span-4">Project</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Budget</div>
            <div className="col-span-2">Timeline</div>
            <div className="col-span-1">Team</div>
            <div className="col-span-1" />
          </div>

          <AnimatePresence initial={false}>
            {filtered.map((p, i) => {
              const sc = STATUS_CFG[p.status] ?? STATUS_CFG.open;
              const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.medium;
              const isExp = expandedId === p.id;
              const filled = (p.team_members ?? []).length;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    background: isExp
                      ? "rgba(0,212,255,0.025)"
                      : "rgba(17,24,39,0.55)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => setExpandedId(isExp ? null : p.id)}
                  >
                    <div className="md:col-span-4 flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {p.title}
                        </h3>
                        <span
                          className="text-[9px] font-mono flex-shrink-0"
                          style={{ color: pc.color }}
                        >
                          ● {pc.label}
                        </span>
                      </div>
                      {p.client && (
                        <span className="text-[10px] font-mono text-slate-600">
                          {p.client}
                        </span>
                      )}
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {p.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.required_skills.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                        {p.required_skills.length > 3 && (
                          <span className="text-[9px] font-mono text-slate-600">
                            +{p.required_skills.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex md:items-center">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest"
                        style={{
                          background: sc.bg,
                          color: sc.color,
                          border: `1px solid ${sc.border}`,
                        }}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-center">
                      <div className="font-mono font-bold text-sm text-white">
                        ${p.budget.toLocaleString()}
                      </div>
                      <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                        total budget
                      </div>
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 font-mono text-sm text-white">
                        <Clock size={12} className="text-slate-500" />{" "}
                        {p.deadline_days}d
                      </div>
                      <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                        {p.created}
                      </div>
                    </div>
                    <div className="md:col-span-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-slate-500" />
                        <span className="font-mono text-sm text-white">
                          {filled}/{p.team_size}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(filled / p.team_size) * 100}%`,
                            background:
                              filled >= p.team_size ? "#10B981" : "#00D4FF",
                          }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-1 flex md:items-center md:justify-end">
                      <motion.div
                        animate={{ rotate: isExp ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown
                          size={16}
                          className={
                            isExp
                              ? "text-cyan-400"
                              : "text-slate-600 group-hover:text-slate-400"
                          }
                        />
                      </motion.div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExp && (
                      <ExpandedRow project={p} freelancerMap={freelancerMap} />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20 gap-4"
              style={{ background: "rgba(17,24,39,0.4)" }}
            >
              <FolderOpen size={32} className="text-slate-700" />
              <p className="text-slate-600 font-mono text-xs uppercase tracking-widest">
                No projects found
              </p>
              <button
                onClick={() => {
                  setFilter("all");
                  setPriorityFilter("all");
                  setSearch("");
                }}
                className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors uppercase tracking-widest"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-600">
          <span>
            Showing {filtered.length} of {projects.length} projects
          </span>
          <span className="ml-auto">
            Pipeline: $
            {projects.reduce((s, p) => s + p.budget, 0).toLocaleString()}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <NewProjectModal
            onClose={() => setShowModal(false)}
            onSave={(p) => setProjects((prev) => [p, ...prev])}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
