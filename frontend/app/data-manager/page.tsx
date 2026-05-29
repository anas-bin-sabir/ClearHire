"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Database, RefreshCw, Trash2, Plus, CheckCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { getSession, isAdmin } from "@/utils/clearhire-auth";
import { useQuery } from "@tanstack/react-query";
import { listFreelancers, listProjects, seedDatabase } from "@/lib/api";

const TABLES = [
  "freelancers",
  "users",
  "projects",
  "contracts",
  "skill_relationships",
];

async function fetchTable(table: string) {
  if (table === "freelancers") {
    const res = await listFreelancers({ limit: 50 });
    const rows = res.freelancers.map((f) => ({
      id: f.id,
      name: f.name,
      hourly_rate: f.hourly_rate,
      rating: f.rating,
      fraud_score: f.fraud_score,
      skills: (f.skills || []).join(", "),
    }));
    return { rows, count: res.total };
  }
  if (table === "projects") {
    const res = await listProjects();
    const rows = res.projects.map((p) => ({
      id: p.id,
      title: p.title,
      budget: p.budget,
      status: p.status,
      team_size: p.team_size,
    }));
    return { rows, count: res.total };
  }
  return { rows: [], count: 0 };
}

export default function DataManagerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [activeTable, setActiveTable] = useState("freelancers");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    const s = getSession();
    if (isAdmin(s)) setAuthed(true);
    else router.replace("/dashboard");
  }, [router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["data-manager", activeTable],
    queryFn: () => fetchTable(activeTable),
    enabled: authed,
    retry: false,
  });

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const d = await seedDatabase(50, true);
      setSeedMsg(
        d.success ? "✓ Database seeded successfully" : "✗ Seed failed",
      );
      refetch();
    } catch {
      setSeedMsg("✗ Connection error");
    } finally {
      setSeeding(false);
    }
  };

  if (!authed) return null;

  const rows = data?.rows ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <AppLayout title="Data Manager — Admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-violet-400" />
            <h2 className="text-xl font-bold text-white">Data Manager</h2>
            <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-mono uppercase tracking-widest">
              Admin Only
            </span>
          </div>
          <div className="flex items-center gap-2">
            {seedMsg && (
              <span
                className={`text-[11px] font-mono ${seedMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}
              >
                {seedMsg}
              </span>
            )}
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest text-black font-bold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7C3AED,#00D4FF)" }}
            >
              <Plus size={12} />
              {seeding ? "Seeding..." : "Seed Database"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {TABLES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTable(t)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all"
              style={
                activeTable === t
                  ? {
                      background: "rgba(124,58,237,0.15)",
                      color: "#A78BFA",
                      border: "1px solid rgba(124,58,237,0.3)",
                    }
                  : { color: "#64748B" }
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {activeTable} · {data?.count ?? 0} rows (FastAPI / PostgreSQL)
            </span>
            <button
              onClick={() => refetch()}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-600 font-mono text-xs">
              Loading from API...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-600 font-mono text-xs">
              No rows — run Seed Database or switch table
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    {columns.map((c) => (
                      <th
                        key={c}
                        className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-slate-600"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id ?? i}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      {columns.map((c) => (
                        <td
                          key={c}
                          className="px-4 py-2.5 text-xs text-slate-400 font-mono truncate max-w-[200px]"
                        >
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
          }}
        >
          <Trash2 size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Users, contracts, and skill_relationships are managed via PostgreSQL
            seed scripts. Use Seed Database to reset and populate all stores
            including Neo4j sync.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
