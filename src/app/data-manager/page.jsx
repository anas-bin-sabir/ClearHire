"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Database, RefreshCw, Trash2, Plus, CheckCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getSession, isAdmin } from "@/utils/clearhire-auth";
import { useQuery } from "@tanstack/react-query";

const TABLES = [
  "freelancers",
  "users",
  "projects",
  "contracts",
  "skill_relationships",
];

export default function DataManagerPage() {
  const [authed, setAuthed] = useState(false);
  const [activeTable, setActiveTable] = useState("freelancers");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    const s = getSession();
    if (isAdmin(s)) setAuthed(true);
    else window.location.href = "/dashboard";
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["data-manager", activeTable],
    queryFn: async () => {
      const res = await fetch(`/api/data-manager?table=${activeTable}`);
      if (!res.ok) return { rows: [], count: 0 };
      return res.json();
    },
    enabled: authed,
    retry: false,
  });

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const d = await res.json();
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
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-mono font-bold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              {seeding ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              {seeding ? "Seeding..." : "Seed Database"}
            </button>
          </div>
        </div>

        {/* Table Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
          {TABLES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTable(t)}
              className={`px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
                activeTable === t
                  ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <motion.div
          key={activeTable}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
          className="rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
              {activeTable} — {data?.count ?? 0} records
            </span>
            <button
              onClick={() => refetch()}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-slate-600 font-mono text-sm">
              Loading...
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="p-12 text-center">
              <Database size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-mono text-sm">
                No records found. Seed the database to populate this table.
              </p>
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-slate-500 uppercase tracking-widest text-[10px]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      {columns.map((col) => {
                        const val = row[col];
                        const display =
                          typeof val === "object"
                            ? JSON.stringify(val).slice(0, 30) + "..."
                            : String(val ?? "—").slice(0, 40);
                        return (
                          <td
                            key={col}
                            className="px-4 py-2.5 text-slate-400 max-w-[160px] truncate"
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
