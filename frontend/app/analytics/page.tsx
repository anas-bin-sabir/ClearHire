"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, TrendingUp, Users, ShieldAlert, Cpu } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getSession, isAdmin } from "@/utils/clearhire-auth";
import { getAnalyticsTimeseries, type TimeSeriesResponse } from "@/lib/api";

const FALLBACK_DATA = [
  { label: "Mon", searches: 48, teams: 12, fraud: 3 },
  { label: "Tue", searches: 62, teams: 18, fraud: 5 },
  { label: "Wed", searches: 55, teams: 14, fraud: 2 },
  { label: "Thu", searches: 79, teams: 22, fraud: 8 },
  { label: "Fri", searches: 91, teams: 27, fraud: 4 },
  { label: "Sat", searches: 34, teams: 9, fraud: 1 },
  { label: "Sun", searches: 28, teams: 6, fraud: 2 },
];

const MAX_VAL = 100;

export default function AnalyticsPage() {
  const [session, setSession] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [barData, setBarData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (isAdmin(s)) {
      setAuthed(true);
      // Load analytics data
      getAnalyticsTimeseries(7)
        .then((res) => {
          setBarData(res.data || FALLBACK_DATA);
        })
        .catch(() => {
          setBarData(FALLBACK_DATA);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      window.location.href = "/dashboard";
    }
  }, []);

  if (!authed) return null;

  const totalSearches = barData.reduce((s, d) => s + d.searches, 0);
  const totalTeams = barData.reduce((s, d) => s + d.teams, 0);
  const totalFraud = barData.reduce((s, d) => s + d.fraud, 0);

  return (
    <AppLayout title="Analytics — Admin">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={18} className="text-violet-400" />
          <h2 className="text-xl font-bold text-white">Platform Analytics</h2>
          <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-mono uppercase tracking-widest">
            Admin Only
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Weekly Searches",
              value: totalSearches,
              icon: Users,
              color: "text-cyan-400",
              trend: "+14%",
            },
            {
              label: "Teams Built",
              value: totalTeams,
              icon: Cpu,
              color: "text-violet-400",
              trend: "+8%",
            },
            {
              label: "Fraud Flagged",
              value: totalFraud,
              icon: ShieldAlert,
              color: "text-red-400",
              trend: "-3%",
            },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: "rgba(17,24,39,0.7)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
              className="p-5 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <kpi.icon size={18} className={kpi.color} />
                <span
                  className={`text-[10px] font-mono ${kpi.trend.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}
                >
                  {kpi.trend} WoW
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">
                {kpi.value}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mt-1">
                {kpi.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
          className="rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400">
              7-Day Activity Overview
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />{" "}
                Searches
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />{" "}
                Teams
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{" "}
                Fraud
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3 h-40">
            {barData.map((d, i) => (
              <div
                key={d.label}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full flex items-end gap-0.5 h-32 relative">
                  {[
                    { val: d.searches, color: "bg-cyan-500/60" },
                    { val: d.teams * 3, color: "bg-violet-500/60" },
                    { val: d.fraud * 10, color: "bg-red-500/60" },
                  ].map((bar, j) => (
                    <motion.div
                      key={j}
                      initial={{ height: 0 }}
                      animate={{ height: `${(bar.val / MAX_VAL) * 100}%` }}
                      transition={{ delay: i * 0.05 + j * 0.02, duration: 0.5 }}
                      className={`flex-1 ${bar.color} rounded-t-sm`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-600">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Skills Heatmap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
          className="rounded-2xl p-6"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-5">
            Most Searched Skills
          </h3>
          <div className="space-y-3">
            {[
              { skill: "Python", pct: 88 },
              { skill: "React", pct: 76 },
              { skill: "ML / Data Science", pct: 65 },
              { skill: "DevOps", pct: 54 },
              { skill: "FastAPI", pct: 42 },
              { skill: "UI/UX", pct: 38 },
            ].map((s) => (
              <div key={s.skill} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-32 flex-shrink-0">
                  {s.skill}
                </span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                  />
                </div>
                <span className="text-xs font-mono text-slate-500 w-8 text-right">
                  {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
