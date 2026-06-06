"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Briefcase, ShieldAlert, Layers, Database, Activity,
  Cpu, Search, CheckCircle2, Clock, Zap, Brain, Network, Shield,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { getSession } from "@/utils/clearhire-auth";
import { getPlatformStats, seedDatabase, getActivityFeed, getRecentSearches } from "@/lib/api";

const AI_MODULES = [
  { name: "A* Search Engine", desc: "Ranking & retrieval", icon: Search, colorVar: "var(--color-primary)", rgbVar: "var(--color-primary-rgb)" },
  { name: "CSP Solver", desc: "Team optimization", icon: Brain, colorVar: "var(--color-secondary)", rgbVar: "var(--color-secondary-rgb)" },
  { name: "Bayesian Fraud", desc: "Risk assessment", icon: Shield, colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
  { name: "Skill Graph", desc: "Relationship mapping", icon: Network, colorVar: "var(--color-warning)", rgbVar: "var(--color-warning-rgb)" },
];

type FeedType = "search" | "fraud" | "team" | "contract";

const FEED_CFG: Record<FeedType, { icon: React.ComponentType<{ size: number }>, colorVar: string, rgbVar: string }> = {
  search: { icon: Search, colorVar: "var(--color-primary)", rgbVar: "var(--color-primary-rgb)" },
  fraud: { icon: ShieldAlert, colorVar: "var(--color-danger)", rgbVar: "var(--color-danger-rgb)" },
  team: { icon: Users, colorVar: "var(--color-secondary)", rgbVar: "var(--color-secondary-rgb)" },
  contract: { icon: CheckCircle2, colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
};

export default function DashboardPage() {
  const [session, setSession] = useState<{ name?: string; role?: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [feedFilter, setFeedFilter] = useState("all");
  const [stats, setStats] = useState({ freelancers_total: 0, open_projects: 0, fraud_flagged: 0, teams_built: 0 });
  const [activityFeed, setActivityFeed] = useState<{ id: string | number; type: string; text: string; time: string }[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ query: string; results: number; time: string }[]>([]);

  useEffect(() => {
    setSession(getSession());
    getPlatformStats().then(setStats).catch(() => {});
    getActivityFeed(20)
      .then((res) =>
        setActivityFeed(
          (res.items || []).map((item) => ({
            id: item.id,
            type: item.type,
            text: item.text,
            time: item.time,
          })),
        ),
      )
      .catch(() => setActivityFeed([]));
    getRecentSearches(5)
      .then((res) => setRecentSearches(res.searches || []))
      .catch(() => setRecentSearches([]));
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
      ? activityFeed
      : activityFeed.filter((e) => e.type === feedFilter);

  const cardStyle = {
    background: `rgba(var(--bg-secondary-rgb), 0.7)`,
    border: `1px solid rgba(var(--border-base), 0.05)`,
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-7 pb-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Welcome back,{" "}
              <span
                className="font-bold"
                style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {session?.name?.split(" ")[0] ?? "Agent"}
              </span>
            </h2>
            <p className="text-sm mt-0.5 font-mono" style={{ color: "var(--text-subtle)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — All systems nominal
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest"
              style={{ background: `rgba(var(--color-primary-rgb), 0.06)`, border: `1px solid rgba(var(--color-primary-rgb), 0.15)`, color: "var(--color-primary)" }}
            >
              <Cpu size={11} style={{ animation: "dpulse 2s ease-in-out infinite" }} />
              4 Modules Online
            </div>
            <button
              onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-50"
              style={{ background: `rgba(var(--border-base), 0.04)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}
            >
              <Database size={11} />
              {seeding ? "Syncing..." : seedMsg || "Sync DB"}
            </button>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Freelancers" value={stats.freelancers_total} icon={Users} color="text-cyan-400" delay={0} trend="live" />
          <StatCard label="Active Projects" value={stats.open_projects} icon={Briefcase} color="text-violet-400" delay={100} trend="live" />
          <StatCard label="Fraud Flagged" value={stats.fraud_flagged} icon={ShieldAlert} color="text-red-400" delay={200} trend="live" />
          <StatCard label="Teams Built" value={stats.teams_built} icon={Layers} color="text-emerald-400" delay={300} trend="live" />
        </div>

        {/* Middle Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Searches */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="p-5 rounded-2xl flex flex-col" style={cardStyle}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Search size={14} style={{ color: "var(--color-primary)" }} />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--text-primary)" }}>
                  Recent Searches
                </h3>
              </div>
              <a href="/search" className="text-[10px] font-mono uppercase tracking-widest transition-colors" style={{ color: `rgba(var(--color-primary-rgb), 0.6)` }}>
                All →
              </a>
            </div>
            <div className="space-y-1">
              {(recentSearches.length > 0 ? recentSearches : []).map((s, i) => (
                <motion.a
                  key={i}
                  href={`/search?q=${encodeURIComponent(s.query)}`}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center justify-between p-2.5 rounded-xl group transition-colors"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = `rgba(var(--border-base), 0.05)`)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "")}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Search size={11} className="flex-shrink-0 transition-colors" style={{ color: "var(--text-subtle)" }} />
                    <span className="text-xs truncate transition-colors" style={{ color: "var(--text-secondary)" }}>
                      {s.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] font-mono" style={{ color: `rgba(var(--color-primary-rgb), 0.7)` }}>
                      {s.results}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>{s.time}</span>
                  </div>
                </motion.a>
              ))}
              {recentSearches.length === 0 && (
                <p className="text-xs font-mono py-4 text-center" style={{ color: "var(--text-subtle)" }}>
                  No searches yet — run a talent search to populate history
                </p>
              )}
            </div>
          </motion.div>

          {/* AI Module Status */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="lg:col-span-2 p-5 rounded-2xl" style={cardStyle}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity size={14} style={{ color: "var(--color-success)", animation: "dpulse 1.5s ease-in-out infinite" }} />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--text-primary)" }}>
                  Intelligence Modules
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-success)" }}>
                4 / 4 Online
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_MODULES.map((mod, i) => (
                <motion.div
                  key={mod.name}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.07 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl"
                  style={{ background: `rgba(var(--border-base), 0.03)`, border: `1px solid rgba(var(--border-base), 0.06)` }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `rgba(${mod.rgbVar}, 0.12)` }}
                  >
                    <mod.icon size={16} style={{ color: mod.colorVar }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{mod.name}</div>
                    <div className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>{mod.desc}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--color-success)", animation: `dpulse ${1.5 + i * 0.3}s ease-in-out infinite` }}
                    />
                    <span className="text-[9px] font-mono uppercase" style={{ color: "var(--color-success)" }}>ONLINE</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)` }}>
              {[
                { href: "/search", label: "Search Talent", colorVar: "var(--color-primary)", rgbVar: "var(--color-primary-rgb)" },
                { href: "/team-builder", label: "Build Team", colorVar: "var(--color-secondary)", rgbVar: "var(--color-secondary-rgb)" },
                { href: "/fraud", label: "Fraud Scan", colorVar: "var(--color-danger)", rgbVar: "var(--color-danger-rgb)" },
              ].map((a) => (
                <a
                  key={a.href} href={a.href}
                  className="flex-1 py-2 rounded-xl text-center text-[10px] font-mono uppercase tracking-wider transition-colors"
                  style={{ color: a.colorVar, background: `rgba(${a.rgbVar}, 0.07)`, border: `1px solid rgba(${a.rgbVar}, 0.2)` }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = `rgba(${a.rgbVar}, 0.14)`)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = `rgba(${a.rgbVar}, 0.07)`)}
                >
                  {a.label}
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="p-5 rounded-2xl" style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--text-primary)" }}>
                Intelligence Stream
              </h3>
            </div>
            <div className="flex flex-wrap gap-1 p-0.5 rounded-lg" style={{ background: `rgba(var(--border-base), 0.04)` }}>
              {["all", "search", "fraud", "team", "contract"].map((t) => (
                <button
                  key={t} onClick={() => setFeedFilter(t)}
                  className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider transition-all"
                  style={
                    feedFilter === t
                      ? { background: `rgba(var(--color-primary-rgb), 0.1)`, color: "var(--color-primary)", border: `1px solid rgba(var(--color-primary-rgb), 0.2)` }
                      : { color: "var(--text-subtle)" }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filteredFeed.length === 0 && (
                <p className="text-xs font-mono py-6 text-center" style={{ color: "var(--text-subtle)" }}>
                  No platform activity yet — search, fraud scan, or build a team
                </p>
              )}
              {filteredFeed.map((event) => {
                const cfg =
                  FEED_CFG[event.type as FeedType] ??
                  FEED_CFG.search;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={event.id} layout
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = `rgba(var(--border-base), 0.02)`)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "")}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `rgba(${cfg.rgbVar}, 0.1)` }}
                    >
                      <Icon size={13} style={{ color: cfg.colorVar }} />
                    </div>
                    <p className="flex-1 text-[12px] leading-relaxed min-w-0" style={{ color: "var(--text-secondary)" }}>
                      {event.text}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0 text-[10px] font-mono whitespace-nowrap" style={{ color: "var(--text-subtle)" }}>
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
