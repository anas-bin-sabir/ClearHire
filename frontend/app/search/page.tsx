"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, SlidersHorizontal, X, Star, MapPin, DollarSign,
  Clock, Shield, ChevronRight, Users, Info, CheckCircle2,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FreelancerCard from "@/components/FreelancerCard";
import AIReasoningBox from "@/components/AIReasoningBox";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { ALL_SKILLS } from "@/data/mockData";
import { searchFreelancers, enrichFreelancer, getPrecomputedSearch } from "@/lib/api";

const PLACEHOLDERS = [
  "Search for a Python ML Engineer...",
  "Find a React UI/UX specialist...",
  "Looking for a DevOps expert...",
  "Hire a FastAPI backend developer...",
  "Search for a Data Science lead...",
];

function FraudGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colorVar = pct < 25 ? "var(--color-success)" : pct < 55 ? "var(--color-warning)" : "var(--color-danger)";
  const rgbVar = pct < 25 ? "var(--color-success-rgb)" : pct < 55 ? "var(--color-warning-rgb)" : "var(--color-danger-rgb)";
  const label = pct < 25 ? "Low Risk" : pct < 55 ? "Medium Risk" : "High Risk";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg viewBox="0 0 88 88" className="w-24 h-24 -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke={`rgba(var(--border-base), 0.05)`} strokeWidth="8" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={colorVar} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-mono font-bold" style={{ color: colorVar }}>{pct}%</span>
          <span className="text-[9px] font-mono uppercase" style={{ color: "var(--text-subtle)" }}>Risk</span>
        </div>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: colorVar }}>{label}</span>
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams ? Number(searchParams.get("project")) || null : null;

  const [query, setQuery] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const [teamList, setTeamList] = useState<any[]>([]);
  const [apiResults, setApiResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [precomputedAt, setPrecomputedAt] = useState<string | null>(null);
  const [usingPrecomputed, setUsingPrecomputed] = useState(false);
  const [filters, setFilters] = useState({ skills: [] as string[], minRate: 0, maxRate: 250, minRating: 0, availableOnly: false, maxFraud: 1 });
  const phRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = PLACEHOLDERS[placeholderIdx];
    let i = 0;
    setDisplayedPlaceholder("");
    const t = setInterval(() => {
      i++;
      setDisplayedPlaceholder(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(t);
        phRef.current = setTimeout(() => setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length), 2200);
      }
    }, 42);
    return () => { clearInterval(t); if (phRef.current) clearTimeout(phRef.current); };
  }, [placeholderIdx]);

  useEffect(() => {
    if (usingPrecomputed) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const res = await searchFreelancers({ query, skills: filters.skills, minRate: filters.minRate > 0 ? filters.minRate : undefined, maxRate: filters.maxRate < 250 ? filters.maxRate : undefined, minRating: filters.minRating > 0 ? filters.minRating : undefined, availableOnly: filters.availableOnly, maxFraud: filters.maxFraud });
        if (!cancelled) { setApiResults(res.freelancers.map(enrichFreelancer)); setExplanation(res.explanation || ""); }
      } catch (err: any) {
        if (!cancelled) { setSearchError(err?.message || "Search failed"); setApiResults([]); }
      } finally { if (!cancelled) setSearchLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, filters.skills, filters.minRate, filters.maxRate, filters.minRating, filters.availableOnly, filters.maxFraud, usingPrecomputed]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getPrecomputedSearch(projectId)
      .then((data) => {
        if (cancelled) return;
        if (data.precomputed && data.ranked_freelancers?.length) {
          setApiResults(data.ranked_freelancers.map(enrichFreelancer));
          setPrecomputedAt(data.ran_at ?? null);
          setUsingPrecomputed(true);
        }
      })
      .catch(() => {/* silent — fall back to manual search */});
    return () => { cancelled = true; };
  }, [projectId]);

  const results = apiResults ?? [];
  const updateFilter = (key: string, val: any) => setFilters((f) => ({ ...f, [key]: val }));
  const toggleSkill = (s: string) => setFilters((f) => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s] }));
  const activeFiltersCount = filters.skills.length + (filters.minRate > 0 ? 1 : 0) + (filters.maxRate < 250 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.availableOnly ? 1 : 0) + (filters.maxFraud < 1 ? 1 : 0);
  const handleAddToTeam = (f: any) => setTeamList((prev) => prev.find((x) => x.id === f.id) ? prev : [...prev, f]);
  const drawerText = selectedFreelancer
    ? `${explanation}\n\nSelected: ${selectedFreelancer.name} — match score ${selectedFreelancer.match_score}% · fraud risk ${Math.round((selectedFreelancer.fraud_score ?? 0) * 100)}%.`
    : explanation;

  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.05)` };
  const clearFilters = () => setFilters({ skills: [], minRate: 0, maxRate: 250, minRating: 0, availableOnly: false, maxFraud: 1 });

  return (
    <AppLayout title="Talent Search">
      <div className="flex gap-6 relative min-h-0">
        {/* Filter Sidebar */}
        <aside className="hidden lg:flex flex-col gap-5 w-64 flex-shrink-0 sticky top-0 max-h-[calc(100vh-100px)] overflow-y-auto pb-6" style={{ scrollbarWidth: "none" }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Filters</span>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-[10px] font-mono transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.7)` }}>
                Clear {activeFiltersCount}
              </button>
            )}
          </div>

          {/* Skills */}
          <div className="p-4 rounded-2xl space-y-3" style={cardStyle}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SKILLS.map((s) => (
                <button
                  key={s} onClick={() => toggleSkill(s)}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono transition-all"
                  style={
                    filters.skills.includes(s)
                      ? { background: `rgba(var(--color-primary-rgb), 0.12)`, color: "var(--color-primary)", border: `1px solid rgba(var(--color-primary-rgb), 0.3)` }
                      : { background: `rgba(var(--border-base), 0.04)`, color: "var(--text-subtle)", border: `1px solid rgba(var(--border-base), 0.07)` }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Rate Range */}
          <div className="p-4 rounded-2xl space-y-4" style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Rate / hr</p>
              <span className="text-[10px] font-mono" style={{ color: "var(--color-primary)" }}>${filters.minRate} – ${filters.maxRate}</span>
            </div>
            <div className="space-y-2">
              <input type="range" min="0" max="250" step="5" value={filters.minRate} onChange={(e) => updateFilter("minRate", +e.target.value)} className="w-full" />
              <input type="range" min="0" max="250" step="5" value={filters.maxRate} onChange={(e) => updateFilter("maxRate", +e.target.value)} className="w-full" style={{ accentColor: "var(--color-secondary)" }} />
            </div>
          </div>

          {/* Rating */}
          <div className="p-4 rounded-2xl space-y-3" style={cardStyle}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Min Rating</p>
            <div className="flex gap-1.5">
              {[0, 4, 4.5, 4.8].map((r) => (
                <button
                  key={r} onClick={() => updateFilter("minRating", r)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-all flex items-center justify-center gap-1"
                  style={
                    filters.minRating === r
                      ? { background: `rgba(var(--color-warning-rgb), 0.12)`, color: "var(--color-warning)", border: `1px solid rgba(var(--color-warning-rgb), 0.25)` }
                      : { background: `rgba(var(--border-base), 0.04)`, color: "var(--text-subtle)", border: `1px solid rgba(var(--border-base), 0.07)` }
                  }
                >
                  {r === 0 ? "Any" : <><Star size={9} fill="currentColor" />{r}+</>}
                </button>
              ))}
            </div>
          </div>

          {/* Availability + Fraud */}
          <div className="p-4 rounded-2xl space-y-4" style={cardStyle}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={filters.availableOnly} onChange={(e) => updateFilter("availableOnly", e.target.checked)} />
                <div className="w-9 h-5 rounded-full transition-colors" style={{ background: filters.availableOnly ? "var(--color-primary)" : `rgba(var(--border-base), 0.08)` }} />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: filters.availableOnly ? "translateX(16px)" : "translateX(0)" }} />
              </div>
              <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>Available only</span>
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--text-subtle)" }}>
                  <Shield size={10} /> Max Fraud
                </p>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-danger)" }}>{Math.round(filters.maxFraud * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={filters.maxFraud} onChange={(e) => updateFilter("maxFraud", +e.target.value)} className="w-full" style={{ accentColor: "var(--color-danger)" }} />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Search bar */}
          <div className="relative group">
            <div
              className="absolute inset-0 rounded-2xl opacity-30 group-focus-within:opacity-60 transition-opacity blur-xl"
              style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.3), rgba(var(--color-secondary-rgb),0.3))` }}
            />
            <div
              className="relative flex items-center rounded-2xl px-4 py-3 gap-3"
              style={{ background: `rgba(var(--bg-secondary-rgb), 0.9)`, border: `1px solid rgba(var(--border-base), 0.1)` }}
            >
              <Search size={18} className="flex-shrink-0" style={{ color: "var(--text-subtle)" }} />
              <input
                type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={displayedPlaceholder}
                className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
                style={{ color: "var(--text-primary)" }}
              />
              {query && (
                <button onClick={() => setQuery("")} className="transition-colors" style={{ color: "var(--text-subtle)" }}>
                  <X size={16} />
                </button>
              )}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all"
                style={{
                  background: activeFiltersCount > 0 ? `rgba(var(--color-primary-rgb), 0.1)` : `rgba(var(--border-base), 0.06)`,
                  color: activeFiltersCount > 0 ? "var(--color-primary)" : "var(--text-subtle)",
                  border: `1px solid ${activeFiltersCount > 0 ? `rgba(var(--color-primary-rgb), 0.25)` : `rgba(var(--border-base), 0.08)`}`,
                }}
              >
                <SlidersHorizontal size={12} /> Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </button>
            </div>
          </div>

          {/* Team bar */}
          <AnimatePresence>
            {teamList.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: `rgba(var(--color-secondary-rgb), 0.08)`, border: `1px solid rgba(var(--color-secondary-rgb), 0.2)` }}
              >
                <Users size={14} style={{ color: "var(--color-secondary)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--color-secondary)" }}>
                  {teamList.length} freelancer{teamList.length !== 1 ? "s" : ""} added to team
                </span>
                <a href="/team-builder" className="ml-auto text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: "var(--color-secondary)" }}>
                  Open Builder →
                </a>
                <button onClick={() => setTeamList([])} className="transition-colors" style={{ color: "var(--text-subtle)" }}>
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
            <span>{searchLoading ? "Searching..." : `${results.length} profiles matched`}</span>
            <span>Sort: A* Match Score</span>
          </div>

          {precomputedAt && (
            <div className="flex items-center gap-2 mb-3">
              <AgentStatusBadge pipeline="matching" ranAt={precomputedAt} />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                Results pre-ranked when project was posted
              </span>
            </div>
          )}

          {searchError && (
            <div className="px-4 py-3 rounded-xl text-xs font-mono" style={{ background: `rgba(var(--color-danger-rgb), 0.1)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)`, color: "var(--color-danger)" }}>
              {searchError}
            </div>
          )}

          {explanation && !searchLoading && (
            <AIReasoningBox key={explanation.slice(0, 40)} text={explanation} speed={12} title="A* SEARCH INTELLIGENCE" />
          )}

          {/* Results */}
          {searchLoading && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `rgba(var(--color-primary-rgb), 0.3)`, borderTopColor: "var(--color-primary)" }} />
              <p className="font-mono text-sm" style={{ color: "var(--text-subtle)" }}>Running A* talent search...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Search size={36} style={{ color: "var(--text-muted)" }} />
              <p className="font-mono text-sm" style={{ color: "var(--text-subtle)" }}>No freelancers match your filters</p>
              <button onClick={clearFilters} className="text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: "var(--color-primary)" }}>
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((f: any, i: number) => (
                <FreelancerCard key={f.id} freelancer={f} index={i} onViewProfile={setSelectedFreelancer} onAddToTeam={handleAddToTeam} />
              ))}
            </div>
          )}
        </div>

        {/* Right Drawer */}
        <AnimatePresence>
          {selectedFreelancer && (
            <>
              <motion.div
                key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedFreelancer(null)}
                className="fixed inset-0 z-[100]"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
              />
              <motion.div
                key="drawer"
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col overflow-hidden"
                style={{ width: "min(520px, 95vw)", background: "var(--bg-surface)", borderLeft: `1px solid rgba(var(--border-base), 0.08)` }}
              >
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid rgba(var(--border-base), 0.06)` }}>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--text-subtle)" }}>Intelligence Profile</span>
                  <button onClick={() => setSelectedFreelancer(null)} className="transition-colors p-1 rounded-lg" style={{ color: "var(--text-subtle)" }}>
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: "none" }}>
                  {/* Hero */}
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-mono font-bold flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.2), rgba(var(--color-secondary-rgb),0.25))`,
                        border: `1px solid rgba(var(--border-base), 0.1)`,
                        color: "var(--text-primary)",
                      }}
                    >
                      {selectedFreelancer.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{selectedFreelancer.name}</h2>
                      <div className="flex flex-wrap gap-3 mt-1 text-[11px] font-mono" style={{ color: "var(--text-subtle)" }}>
                        {selectedFreelancer.location && <span className="flex items-center gap-1"><MapPin size={10} /> {selectedFreelancer.location}</span>}
                        <span className="flex items-center gap-1"><Clock size={10} /> {selectedFreelancer.experience_years}y exp</span>
                        <span className="flex items-center gap-1"><DollarSign size={10} /> ${selectedFreelancer.hourly_rate}/hr</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12} className={selectedFreelancer.rating >= s ? "text-yellow-400 fill-yellow-400" : "text-slate-700"} />
                        ))}
                        <span className="text-xs ml-1 font-mono" style={{ color: "var(--text-subtle)" }}>{Number(selectedFreelancer.rating).toFixed(1)}</span>
                        <span
                          className="ml-2 px-2 py-0.5 rounded-md text-[9px] font-mono"
                          style={
                            selectedFreelancer.availability
                              ? { color: "var(--color-success)", background: `rgba(var(--color-success-rgb), 0.1)`, border: `1px solid rgba(var(--color-success-rgb), 0.2)` }
                              : { color: "var(--text-subtle)", background: `rgba(var(--border-base), 0.05)` }
                          }
                        >
                          {selectedFreelancer.availability ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match + Fraud */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl text-center" style={{ background: `rgba(var(--color-primary-rgb), 0.05)`, border: `1px solid rgba(var(--color-primary-rgb), 0.12)` }}>
                      <div className="text-2xl font-mono font-bold" style={{ color: "var(--color-primary)" }}>{selectedFreelancer.match_score}%</div>
                      <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "var(--text-subtle)" }}>Match Score</div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.06)` }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${selectedFreelancer.match_score}%` }} transition={{ delay: 0.2, duration: 0.8 }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl flex flex-col items-center" style={{ background: `rgba(var(--bg-secondary-rgb), 0.6)`, border: `1px solid rgba(var(--border-base), 0.06)` }}>
                      <FraudGauge score={selectedFreelancer.fraud_score} />
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>About</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{selectedFreelancer.bio}</p>
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Skill Set</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFreelancer.skills.map((s: string) => (
                        <span
                          key={s} className="px-3 py-1 rounded-lg text-xs font-mono"
                          style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, border: `1px solid rgba(var(--color-primary-rgb), 0.18)`, color: "var(--color-primary)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reviews */}
                  {selectedFreelancer.reviews?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Reviews</p>
                      {selectedFreelancer.reviews.map((r: any, i: number) => (
                        <div key={i} className="p-3.5 rounded-xl space-y-2" style={{ background: `rgba(var(--border-base), 0.03)`, border: `1px solid rgba(var(--border-base), 0.06)` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{r.author}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={10} className={r.rating >= s ? "text-yellow-400 fill-yellow-400" : "text-slate-700"} />)}
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>"{r.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Reasoning */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
                      <Info size={10} /> AI Reasoning
                    </p>
                    <AIReasoningBox key={selectedFreelancer.id} text={drawerText} speed={14} />
                  </div>
                </div>

                {/* Drawer footer */}
                <div className="p-5 flex gap-3 flex-shrink-0" style={{ borderTop: `1px solid rgba(var(--border-base), 0.06)` }}>
                  <a
                    href={`/profile/${selectedFreelancer.id}`}
                    className="flex-1 py-2.5 rounded-xl text-center text-xs font-mono font-semibold uppercase tracking-wider transition-all"
                    style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-secondary)" }}
                  >
                    Full Profile
                  </a>
                  <button
                    onClick={() => { handleAddToTeam(selectedFreelancer); setSelectedFreelancer(null); }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all text-white flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}
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
