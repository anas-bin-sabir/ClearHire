"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Briefcase,
  ShieldAlert,
  Layers,
  Database,
  Activity,
  Cpu,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  Network,
  Shield,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { getSession } from "@/utils/clearhire-auth";
import { getPlatformStats, seedDatabase } from "@/lib/api";
import { ACTIVITY_FEED } from "@/data/mockData";

const AI_MODULES = [
  {
    name: "A* Search Engine",
    desc: "Ranking & retrieval",
    icon: Search,
    color: "#00D4FF",
  },
  {
    name: "CSP Solver",
    desc: "Team optimization",
    icon: Brain,
    color: "#7C3AED",
  },
  {
    name: "Bayesian Fraud",
    desc: "Risk assessment",
    icon: Shield,
    color: "#10B981",
  },
  {
    name: "Skill Graph",
    desc: "Relationship mapping",
    icon: Network,
    color: "#F59E0B",
  },
];

const FEED_CFG = {
  search: { icon: Search, color: "#00D4FF", bg: "rgba(0,212,255,0.1)" },
  fraud: { icon: ShieldAlert, color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  team: { icon: Users, color: "#7C3AED", bg: "rgba(124,58,237,0.1)" },
  contract: {
    icon: CheckCircle2,
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
  },
};

const RECENT_SEARCHES = [
  { query: "Python ML Engineer", results: 12, time: "2m ago" },
  { query: "React UI/UX designer", results: 8, time: "14m ago" },
  { query: "DevOps Kubernetes", results: 5, time: "1h ago" },
  { query: "FastAPI backend developer", results: 9, time: "2h ago" },
  { query: "Data Science pipeline", results: 7, time: "3h ago" },
];

export default function DashboardPage() {
  const [session, setSession] = useState<{
    name?: string;
    role?: string;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [feedFilter, setFeedFilter] = useState("all");
  const [stats, setStats] = useState({
    freelancers_total: 0,
    open_projects: 0,
    fraud_flagged: 0,
    teams_built: 0,
  });

  useEffect(() => {
    setSession(getSession());
    getPlatformStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const data = await seedDatabase(50, false);
      setSeedMsg(data.success ? "✓ Synced" : "✗ Failed");
    } catch {
      setSeedMsg("✗ Error");
    } finally {
      setSeeding(false);
    }
  };

  const filteredFeed =
    feedFilter === "all"
      ? ACTIVITY_FEED
      : ACTIVITY_FEED.filter((e) => e.type === feedFilter);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-7 pb-10">
        {/* ── Greeting ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-xl font-semibold text-white">
              Welcome back,{" "}
              <span
                className="font-bold"
                style={{
                  background: "linear-gradient(90deg,#00D4FF,#7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {session?.name?.split(" ")[0] ?? "Agent"}
              </span>
            </h2>
            <p className="text-slate-500 text-sm mt-0.5 font-mono">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              — All systems nominal
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-cyan-400"
              style={{
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.15)",
              }}
            >
              <Cpu
                size={11}
                style={{ animation: "dpulse 2s ease-in-out infinite" }}
              />
              4 Modules Online
            </div>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-slate-400 transition-colors disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Database size={11} />
              {seeding ? "Syncing..." : seedMsg || "Sync DB"}
            </button>
          </div>
        </motion.div>

        {/* ── Stat Cards (count-up) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Freelancers"
            value={stats.freelancers_total}
            icon={Users}
            color="text-cyan-400"
            delay={0}
            trend="live"
          />
          <StatCard
            label="Active Projects"
            value={stats.open_projects}
            icon={Briefcase}
            color="text-violet-400"
            delay={100}
            trend="live"
          />
          <StatCard
            label="Fraud Flagged"
            value={stats.fraud_flagged}
            icon={ShieldAlert}
            color="text-red-400"
            delay={200}
            trend="live"
          />
          <StatCard
            label="Teams Built"
            value={stats.teams_built}
            icon={Layers}
            color="text-emerald-400"
            delay={300}
            trend="live"
          />
        </div>

        {/* ── Middle Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Searches */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-5 rounded-2xl flex flex-col"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Search size={14} className="text-cyan-400" />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white">
                  Recent Searches
                </h3>
              </div>
              <a
                href="/search"
                className="text-[10px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors uppercase tracking-widest"
              >
                All →
              </a>
            </div>
            <div className="space-y-1">
              {RECENT_SEARCHES.map((s, i) => (
                <motion.a
                  key={i}
                  href={`/search?q=${encodeURIComponent(s.query)}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center justify-between p-2.5 rounded-xl group hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Search
                      size={11}
                      className="text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0"
                    />
                    <span className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">
                      {s.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] font-mono text-cyan-400/70">
                      {s.results}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">
                      {s.time}
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* AI Module Status */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2 p-5 rounded-2xl"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity
                  size={14}
                  className="text-emerald-400"
                  style={{ animation: "dpulse 1.5s ease-in-out infinite" }}
                />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white">
                  Intelligence Modules
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                4 / 4 Online
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_MODULES.map((mod, i) => (
                <motion.div
                  key={mod.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${mod.color}18` }}
                  >
                    <mod.icon size={16} style={{ color: mod.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {mod.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {mod.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      style={{
                        animation: `dpulse ${1.5 + i * 0.3}s ease-in-out infinite`,
                      }}
                    />
                    <span className="text-[9px] font-mono text-emerald-400 uppercase">
                      ONLINE
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            <div
              className="flex gap-2 mt-4 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              {[
                { href: "/search", label: "Search Talent", color: "#00D4FF" },
                {
                  href: "/team-builder",
                  label: "Build Team",
                  color: "#7C3AED",
                },
                { href: "/fraud", label: "Fraud Scan", color: "#EF4444" },
              ].map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex-1 py-2 rounded-xl text-center text-[10px] font-mono uppercase tracking-wider transition-colors"
                  style={{
                    color: a.color,
                    background: `${a.color}0D`,
                    border: `1px solid ${a.color}25`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${a.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${a.color}0D`;
                  }}
                >
                  {a.label}
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Activity Feed ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="p-5 rounded-2xl"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white">
                Intelligence Stream
              </h3>
            </div>
            <div
              className="flex flex-wrap gap-1 p-0.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {["all", "search", "fraud", "team", "contract"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFeedFilter(t)}
                  className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider transition-all"
                  style={
                    feedFilter === t
                      ? {
                          background: "rgba(0,212,255,0.1)",
                          color: "#00D4FF",
                          border: "1px solid rgba(0,212,255,0.2)",
                        }
                      : { color: "#64748B" }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filteredFeed.map((event) => {
                const cfg = FEED_CFG[event.type] ?? FEED_CFG.search;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: cfg.bg }}
                    >
                      <Icon size={13} style={{ color: cfg.color }} />
                    </div>
                    <p className="flex-1 text-[12px] text-slate-300 leading-relaxed min-w-0">
                      {event.text}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0 text-[10px] font-mono text-slate-600 whitespace-nowrap">
                      <Clock size={10} /> {event.time}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes dpulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
      `}</style>
    </AppLayout>
  );
}
