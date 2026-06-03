"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Users, ShieldAlert, Cpu } from "lucide-react";
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
  const [authed, setAuthed] = useState(false);
  const [barData, setBarData] = useState(FALLBACK_DATA);

  useEffect(() => {
    const s = getSession();
    if (isAdmin(s)) {
      setAuthed(true);
      getAnalyticsTimeseries(7).then((res) => setBarData(res.data || FALLBACK_DATA)).catch(() => setBarData(FALLBACK_DATA));
    } else {
      window.location.href = "/dashboard";
    }
  }, []);

  if (!authed) return null;

  const totalSearches = barData.reduce((s, d) => s + d.searches, 0);
  const totalTeams = barData.reduce((s, d) => s + d.teams, 0);
  const totalFraud = barData.reduce((s, d) => s + d.fraud, 0);
  const cardStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.05)` };

  return (
    <AppLayout title="Analytics — Admin">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={18} style={{ color: "var(--color-secondary)" }} />
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Platform Analytics</h2>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-widest"
            style={{ background: `rgba(var(--color-secondary-rgb), 0.1)`, border: `1px solid rgba(var(--color-secondary-rgb), 0.2)`, color: "var(--color-secondary)" }}>
            Admin Only
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Weekly Searches", value: totalSearches, icon: Users, colorVar: "var(--color-primary)", trend: "+14%" },
            { label: "Teams Built", value: totalTeams, icon: Cpu, colorVar: "var(--color-secondary)", trend: "+8%" },
            { label: "Fraud Flagged", value: totalFraud, icon: ShieldAlert, colorVar: "var(--color-danger)", trend: "-3%" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-5 rounded-2xl" style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <kpi.icon size={18} style={{ color: kpi.colorVar }} />
                <span className="text-[10px] font-mono" style={{ color: kpi.trend.startsWith("+") ? "var(--color-success)" : "var(--color-danger)" }}>{kpi.trend} WoW</span>
              </div>
              <div className="text-3xl font-mono font-bold" style={{ color: "var(--text-primary)" }}>{kpi.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest mt-1" style={{ color: "var(--text-subtle)" }}>{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>7-Day Activity Overview</h3>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              {[
                { label: "Searches", colorVar: "var(--color-primary)" },
                { label: "Teams", colorVar: "var(--color-secondary)" },
                { label: "Fraud", colorVar: "var(--color-danger)" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: item.colorVar }} />
                  <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3 h-40">
            {barData.map((d, i) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-32 relative">
                  {[
                    { val: d.searches, colorVar: "var(--color-primary)" },
                    { val: d.teams * 3, colorVar: "var(--color-secondary)" },
                    { val: d.fraud * 10, colorVar: "var(--color-danger)" },
                  ].map((bar, j) => (
                    <motion.div
                      key={j}
                      initial={{ height: 0 }}
                      animate={{ height: `${(bar.val / MAX_VAL) * 100}%` }}
                      transition={{ delay: i * 0.05 + j * 0.02, duration: 0.5 }}
                      className="flex-1 rounded-t-sm opacity-70"
                      style={{ background: bar.colorVar }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>{d.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Skills Heatmap */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-2xl p-6" style={cardStyle}>
          <h3 className="font-mono text-xs uppercase tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>Most Searched Skills</h3>
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
                <span className="text-xs font-mono w-32 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{s.skill}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: `rgba(var(--border-base), 0.05)` }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.6, delay: 0.5 }} className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }} />
                </div>
                <span className="text-xs font-mono w-8 text-right" style={{ color: "var(--text-subtle)" }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
