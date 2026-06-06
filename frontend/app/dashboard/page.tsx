"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Briefcase, ShieldAlert, Brain, Search, CheckCircle2, Clock,
  Cpu, Database, Activity, Shield, Network, ArrowUpRight,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getSession } from "@/utils/clearhire-auth";
import { getPlatformStats, seedDatabase, getActivityFeed, getRecentSearches } from "@/lib/api";

const AI_MODULES = [
  { name: "A* Search Engine", desc: "Ranking & retrieval", icon: Search, href: "/search" },
  { name: "CSP Solver", desc: "Team optimization", icon: Brain, href: "/team-builder" },
  { name: "Bayesian Fraud", desc: "Risk assessment", icon: Shield, href: "/fraud" },
  { name: "Skill Graph", desc: "Relationship mapping", icon: Network, href: "/graph" },
];

type FeedType = "search" | "fraud" | "team" | "contract";

const FEED_CFG: Record<FeedType, { icon: React.ComponentType<{ size: number }>; variant: "primary" | "danger" | "success" | "warning" }> = {
  search: { icon: Search, variant: "primary" },
  fraud: { icon: ShieldAlert, variant: "danger" },
  team: { icon: Users, variant: "warning" },
  contract: { icon: CheckCircle2, variant: "success" },
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
      setSeedMsg(data.success ? "Synced" : "Failed");
    } catch {
      setSeedMsg("Error");
    } finally {
      setSeeding(false);
    }
  };

  const aiDecisionsToday = stats.teams_built + stats.fraud_flagged;
  const filteredFeed =
    feedFilter === "all" ? activityFeed : activityFeed.filter((e) => e.type === feedFilter);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-8 pb-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div>
            <h1 className="page-title">
              Welcome back, {session?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-meta mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {" · "}All intelligence systems operational
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success border border-success/20">
              <Cpu size={14} /> 4 modules online
            </span>
            <Button variant="outline" size="sm" onClick={handleSeed} loading={seeding}>
              <Database size={14} />
              {seeding ? "Syncing…" : seedMsg || "Sync database"}
            </Button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Freelancers"
            value={stats.freelancers_total}
            icon={Users}
            variant="primary"
            delay={0}
            trend="+12%"
            trendDirection="up"
          />
          <StatCard
            label="Active Projects"
            value={stats.open_projects}
            icon={Briefcase}
            variant="primary"
            delay={80}
            trend="+3"
            trendDirection="up"
          />
          <StatCard
            label="Fraud Alerts"
            value={stats.fraud_flagged}
            icon={ShieldAlert}
            variant="danger"
            delay={160}
            trend="-2"
            trendDirection="down"
          />
          <StatCard
            label="AI Decisions Today"
            value={aiDecisionsToday}
            icon={Brain}
            variant="success"
            delay={240}
            trend="Live"
            trendDirection="neutral"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Searches */}
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title text-base flex items-center gap-2">
                <Search size={16} className="text-primary" />
                Recent Searches
              </h2>
              <a href="/search" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="space-y-1">
              {recentSearches.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No searches yet</p>
              ) : (
                recentSearches.map((s, i) => (
                  <a
                    key={i}
                    href={`/search?q=${encodeURIComponent(s.query)}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-background/60 transition-colors group"
                  >
                    <span className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {s.query}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2 text-xs text-muted">
                      <span className="text-primary font-medium">{s.results}</span>
                      <span>{s.time}</span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </Card>

          {/* Intelligence Modules */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="section-title text-base flex items-center gap-2">
                <Activity size={16} className="text-success" />
                Intelligence Modules
              </h2>
              <span className="text-xs font-medium text-success">4 / 4 online</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_MODULES.map((mod) => (
                <a
                  key={mod.name}
                  href={mod.href}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-background/40 hover:border-primary/25 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15">
                    <mod.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{mod.name}</div>
                    <div className="text-xs text-muted">{mod.desc}</div>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                </a>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="section-title text-base">Intelligence Stream</h2>
            <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-background border border-border">
              {["all", "search", "fraud", "team", "contract"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFeedFilter(t)}
                  className={[
                    "px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all",
                    feedFilter === t
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filteredFeed.length === 0 && (
                <p className="text-sm text-muted py-8 text-center">No platform activity yet</p>
              )}
              {filteredFeed.map((event) => {
                const cfg = FEED_CFG[event.type as FeedType] ?? FEED_CFG.search;
                const Icon = cfg.icon;
                const iconBg = {
                  primary: "bg-primary/10 text-primary",
                  danger: "bg-danger/10 text-danger",
                  warning: "bg-warning/10 text-warning",
                  success: "bg-success/10 text-success",
                }[cfg.variant];
                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-background/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                      <Icon size={14} />
                    </div>
                    <p className="flex-1 text-sm text-muted leading-relaxed min-w-0">{event.text}</p>
                    <span className="flex items-center gap-1 text-xs text-muted whitespace-nowrap">
                      <Clock size={12} /> {event.time}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
