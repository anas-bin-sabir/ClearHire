"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  SlidersHorizontal,
  X,
  Star,
  MapPin,
  DollarSign,
  Clock,
  Shield,
  ChevronRight,
  Users,
  Info,
  CheckCircle2,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FreelancerCard from "@/components/FreelancerCard";
import AIReasoningBox from "@/components/AIReasoningBox";
import { FREELANCERS, filterFreelancers, ALL_SKILLS } from "@/data/mockData";

const PLACEHOLDERS = [
  "Search for a Python ML Engineer...",
  "Find a React UI/UX specialist...",
  "Looking for a DevOps expert...",
  "Hire a FastAPI backend developer...",
  "Search for a Data Science lead...",
];

function FraudGauge({ score }) {
  const pct = Math.round(score * 100);
  const color = pct < 25 ? "#10B981" : pct < 55 ? "#F59E0B" : "#EF4444";
  const label = pct < 25 ? "Low Risk" : pct < 55 ? "Medium Risk" : "High Risk";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg viewBox="0 0 88 88" className="w-24 h-24 -rotate-90">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-mono font-bold" style={{ color }}>
            {pct}%
          </span>
          <span className="text-[9px] font-mono text-slate-600 uppercase">
            Risk
          </span>
        </div>
      </div>
      <span
        className="text-[10px] font-mono uppercase tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function DrawerReasoningText(freelancer) {
  const score = freelancer.match_score;
  const risk = Math.round(freelancer.fraud_score * 100);
  const topSkills = freelancer.skills.slice(0, 3).join(", ");
  return (
    `Evaluating candidate ${freelancer.name} using A* heuristic search with multi-factor cost function. ` +
    `Primary strengths: ${topSkills}. Match score ${score}% derived from skill overlap (weight: 0.45), ` +
    `experience coefficient ${freelancer.experience_years}y (weight: 0.30), and rate alignment at $${freelancer.hourly_rate}/hr (weight: 0.25). ` +
    `Bayesian fraud probability: ${risk}% — ` +
    (risk < 25
      ? "profile appears authentic with consistent review patterns and verified portfolio signals."
      : risk < 55
        ? "moderate anomaly signals detected; recommend manual review of portfolio links."
        : "HIGH RISK: account exhibits synthetic review patterns and rate/experience mismatch. Proceed with caution.") +
    ` Account tenure: ${freelancer.account_age_days} days. Recommendation: ` +
    (score >= 80
      ? "STRONG MATCH — prioritise for outreach."
      : score >= 60
        ? "MODERATE MATCH — consider for shortlist."
        : "LOW MATCH — review alternatives first.")
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const [teamList, setTeamList] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    skills: [],
    minRate: 0,
    maxRate: 250,
    minRating: 0,
    availableOnly: false,
    maxFraud: 1,
  });

  // Rotating animated placeholder
  const phRef = useRef(null);
  useEffect(() => {
    const target = PLACEHOLDERS[placeholderIdx];
    let i = 0;
    setDisplayedPlaceholder("");
    const t = setInterval(() => {
      i++;
      setDisplayedPlaceholder(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(t);
        phRef.current = setTimeout(() => {
          setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length);
        }, 2200);
      }
    }, 42);
    return () => {
      clearInterval(t);
      clearTimeout(phRef.current);
    };
  }, [placeholderIdx]);

  // Live filter
  const results = useMemo(
    () => filterFreelancers(FREELANCERS, { query, ...filters }),
    [query, filters],
  );

  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const toggleSkill = (s) =>
    setFilters((f) => ({
      ...f,
      skills: f.skills.includes(s)
        ? f.skills.filter((x) => x !== s)
        : [...f.skills, s],
    }));
  const activeFiltersCount =
    filters.skills.length +
    (filters.minRate > 0 ? 1 : 0) +
    (filters.maxRate < 250 ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.availableOnly ? 1 : 0) +
    (filters.maxFraud < 1 ? 1 : 0);

  const handleAddToTeam = (f) => {
    setTeamList((prev) =>
      prev.find((x) => x.id === f.id) ? prev : [...prev, f],
    );
  };

  const drawerText = selectedFreelancer
    ? DrawerReasoningText(selectedFreelancer)
    : "";

  return (
    <AppLayout title="Talent Search">
      <div className="flex gap-6 relative min-h-0">
        {/* ── Filter Sidebar (desktop) ── */}
        <aside
          className="hidden lg:flex flex-col gap-5 w-64 flex-shrink-0 sticky top-0 max-h-[calc(100vh-100px)] overflow-y-auto pb-6"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Filters
            </span>
            {activeFiltersCount > 0 && (
              <button
                onClick={() =>
                  setFilters({
                    skills: [],
                    minRate: 0,
                    maxRate: 250,
                    minRating: 0,
                    availableOnly: false,
                    maxFraud: 1,
                  })
                }
                className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors"
              >
                Clear {activeFiltersCount}
              </button>
            )}
          </div>

          {/* Skills */}
          <div
            className="p-4 rounded-2xl space-y-3"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SKILLS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSkill(s)}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono transition-all"
                  style={
                    filters.skills.includes(s)
                      ? {
                          background: "rgba(0,212,255,0.12)",
                          color: "#00D4FF",
                          border: "1px solid rgba(0,212,255,0.3)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: "#64748B",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Rate Range */}
          <div
            className="p-4 rounded-2xl space-y-4"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Rate / hr
              </p>
              <span className="text-[10px] font-mono text-cyan-400">
                ${filters.minRate} – ${filters.maxRate}
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={filters.minRate}
                onChange={(e) => updateFilter("minRate", +e.target.value)}
                className="w-full"
                style={{ accentColor: "#00D4FF" }}
              />
              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={filters.maxRate}
                onChange={(e) => updateFilter("maxRate", +e.target.value)}
                className="w-full"
                style={{ accentColor: "#7C3AED" }}
              />
            </div>
          </div>

          {/* Rating */}
          <div
            className="p-4 rounded-2xl space-y-3"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Min Rating
            </p>
            <div className="flex gap-1.5">
              {[0, 4, 4.5, 4.8].map((r) => (
                <button
                  key={r}
                  onClick={() => updateFilter("minRating", r)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-all flex items-center justify-center gap-1"
                  style={
                    filters.minRating === r
                      ? {
                          background: "rgba(245,158,11,0.12)",
                          color: "#F59E0B",
                          border: "1px solid rgba(245,158,11,0.25)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: "#64748B",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }
                  }
                >
                  {r === 0 ? (
                    "Any"
                  ) : (
                    <>
                      <Star size={9} fill="currentColor" />
                      {r}+
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Availability + Fraud */}
          <div
            className="p-4 rounded-2xl space-y-4"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={filters.availableOnly}
                  onChange={(e) =>
                    updateFilter("availableOnly", e.target.checked)
                  }
                />
                <div
                  className="w-9 h-5 rounded-full transition-colors"
                  style={{
                    background: filters.availableOnly
                      ? "#00D4FF"
                      : "rgba(255,255,255,0.08)",
                  }}
                />
                <div
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{
                    transform: filters.availableOnly
                      ? "translateX(16px)"
                      : "translateX(0)",
                  }}
                />
              </div>
              <span className="text-[11px] text-slate-300 font-mono">
                Available only
              </span>
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <Shield size={10} /> Max Fraud
                </p>
                <span className="text-[10px] font-mono text-red-400">
                  {Math.round(filters.maxFraud * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={filters.maxFraud}
                onChange={(e) => updateFilter("maxFraud", +e.target.value)}
                className="w-full"
                style={{ accentColor: "#EF4444" }}
              />
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Search bar */}
          <div className="relative group">
            <div
              className="absolute inset-0 rounded-2xl opacity-30 group-focus-within:opacity-60 transition-opacity blur-xl"
              style={{
                background:
                  "linear-gradient(135deg,rgba(0,212,255,0.3),rgba(124,58,237,0.3))",
              }}
            />
            <div
              className="relative flex items-center rounded-2xl px-4 py-3 gap-3"
              style={{
                background: "rgba(17,24,39,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Search size={18} className="text-slate-500 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={displayedPlaceholder}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-600 font-mono"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all relative"
                style={{
                  background:
                    activeFiltersCount > 0
                      ? "rgba(0,212,255,0.1)"
                      : "rgba(255,255,255,0.06)",
                  color: activeFiltersCount > 0 ? "#00D4FF" : "#64748B",
                  border: `1px solid ${activeFiltersCount > 0 ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <SlidersHorizontal size={12} /> Filters{" "}
                {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </button>
            </div>
          </div>

          {/* Team bar */}
          <AnimatePresence>
            {teamList.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
              >
                <Users size={14} className="text-violet-400" />
                <span className="text-xs font-mono text-violet-300">
                  {teamList.length} freelancer{teamList.length !== 1 ? "s" : ""}{" "}
                  added to team
                </span>
                <a
                  href="/team-builder"
                  className="ml-auto text-[10px] font-mono uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Open Builder →
                </a>
                <button
                  onClick={() => setTeamList([])}
                  className="text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results meta */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span>{results.length} profiles matched</span>
            <span>Sort: A* Match Score</span>
          </div>

          {/* Results grid */}
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Search size={36} className="text-slate-700" />
              <p className="text-slate-600 font-mono text-sm">
                No freelancers match your filters
              </p>
              <button
                onClick={() =>
                  setFilters({
                    skills: [],
                    minRate: 0,
                    maxRate: 250,
                    minRating: 0,
                    availableOnly: false,
                    maxFraud: 1,
                  })
                }
                className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest hover:text-cyan-300 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((f, i) => (
                <FreelancerCard
                  key={f.id}
                  freelancer={f}
                  index={i}
                  onViewProfile={setSelectedFreelancer}
                  onAddToTeam={handleAddToTeam}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right Drawer ── */}
        <AnimatePresence>
          {selectedFreelancer && (
            <>
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedFreelancer(null)}
                className="fixed inset-0 z-[100]"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(4px)",
                }}
              />
              <motion.div
                key="drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col overflow-hidden"
                style={{
                  width: "min(520px, 95vw)",
                  background: "#0D1117",
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Drawer header */}
                <div
                  className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                    Intelligence Profile
                  </span>
                  <button
                    onClick={() => setSelectedFreelancer(null)}
                    className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer body */}
                <div
                  className="flex-1 overflow-y-auto p-6 space-y-6"
                  style={{ scrollbarWidth: "none" }}
                >
                  {/* Hero */}
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-mono font-bold text-white flex-shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,58,237,0.25))",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {selectedFreelancer.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white">
                        {selectedFreelancer.name}
                      </h2>
                      <div className="flex flex-wrap gap-3 mt-1 text-[11px] font-mono text-slate-500">
                        {selectedFreelancer.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={10} /> {selectedFreelancer.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={10} />{" "}
                          {selectedFreelancer.experience_years}y exp
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} /> $
                          {selectedFreelancer.hourly_rate}/hr
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            className={
                              selectedFreelancer.rating >= s
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-slate-700"
                            }
                          />
                        ))}
                        <span className="text-slate-500 text-xs ml-1 font-mono">
                          {Number(selectedFreelancer.rating).toFixed(1)}
                        </span>
                        <span
                          className="ml-2 px-2 py-0.5 rounded-md text-[9px] font-mono"
                          style={
                            selectedFreelancer.availability
                              ? {
                                  color: "#10B981",
                                  background: "rgba(16,185,129,0.1)",
                                  border: "1px solid rgba(16,185,129,0.2)",
                                }
                              : {
                                  color: "#64748B",
                                  background: "rgba(255,255,255,0.05)",
                                }
                          }
                        >
                          {selectedFreelancer.availability
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match + Fraud row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="p-4 rounded-xl text-center"
                      style={{
                        background: "rgba(0,212,255,0.05)",
                        border: "1px solid rgba(0,212,255,0.12)",
                      }}
                    >
                      <div className="text-2xl font-mono font-bold text-cyan-400">
                        {selectedFreelancer.match_score}%
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
                        Match Score
                      </div>
                      <div
                        className="mt-2 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${selectedFreelancer.match_score}%`,
                          }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                          className="h-full rounded-full"
                          style={{
                            background:
                              "linear-gradient(90deg,#00D4FF,#7C3AED)",
                          }}
                        />
                      </div>
                    </div>
                    <div
                      className="p-4 rounded-xl flex flex-col items-center"
                      style={{
                        background: "rgba(17,24,39,0.6)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <FraudGauge score={selectedFreelancer.fraud_score} />
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      About
                    </p>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {selectedFreelancer.bio}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      Skill Set
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFreelancer.skills.map((s) => (
                        <span
                          key={s}
                          className="px-3 py-1 rounded-lg text-xs font-mono text-cyan-300"
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

                  {/* Reviews */}
                  {selectedFreelancer.reviews?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        Reviews
                      </p>
                      {selectedFreelancer.reviews.map((r, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl space-y-2"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">
                              {r.author}
                            </span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={10}
                                  className={
                                    r.rating >= s
                                      ? "text-yellow-400 fill-yellow-400"
                                      : "text-slate-700"
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-slate-400 text-xs leading-relaxed">
                            "{r.text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Reasoning */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Info size={10} /> AI Reasoning
                    </p>
                    <AIReasoningBox
                      key={selectedFreelancer.id}
                      text={drawerText}
                      speed={14}
                    />
                  </div>
                </div>

                {/* Drawer footer */}
                <div
                  className="p-5 flex gap-3 flex-shrink-0"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <a
                    href={`/profile/${selectedFreelancer.id}`}
                    className="flex-1 py-2.5 rounded-xl text-center text-xs font-mono font-semibold uppercase tracking-wider transition-all text-slate-300"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    Full Profile
                  </a>
                  <button
                    onClick={() => {
                      handleAddToTeam(selectedFreelancer);
                      setSelectedFreelancer(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all text-black flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg,#00D4FF,#7C3AED)",
                    }}
                  >
                    <CheckCircle2 size={14} /> Add to Team
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
