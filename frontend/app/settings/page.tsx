"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  User,
  Shield,
  Bell,
  Cpu,
  Trash2,
  Save,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Sliders,
  X,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  getSession,
  setCachedSession,
  clearSession,
} from "@/utils/clearhire-auth";
import {
  getUserSettings,
  updateUserSettings,
  type UserPreferences,
} from "@/lib/api";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Preferences", icon: Cpu },
  { id: "danger", label: "Danger Zone", icon: Trash2 },
];

const INPUT =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono";

function Toggle({ checked, onChange, color = "#00D4FF" }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: checked ? color + "30" : "rgba(255,255,255,0.08)",
        border: `1px solid ${checked ? color + "50" : "rgba(255,255,255,0.12)"}`,
      }}
    >
      <motion.div
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="absolute top-1 w-4 h-4 rounded-full"
        style={{ background: checked ? color : "#475569" }}
      />
    </button>
  );
}

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  color = "#00D4FF",
  label,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div
        className="relative h-2 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${((value - min) / (max - min)) * 100}%`,
            background: `linear-gradient(90deg,${color}90,${color})`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 1 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all"
          style={{
            left: `calc(${((value - min) / (max - min)) * 100}% - 8px)`,
            background: color,
            borderColor: "#0A0D14",
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────
function ProfileSection({ session, onSessionUpdate }) {
  const [form, setForm] = useState({
    name: session?.name ?? "",
    email: session?.email ?? "",
    department: session?.department ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    const updated = { ...session, ...form };
    setCachedSession(updated);
    onSessionUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handlePwSave = () => {
    if (!pw.next || pw.next !== pw.confirm) {
      setPwMsg("Passwords do not match");
      return;
    }
    if (pw.next.length < 6) {
      setPwMsg("Password must be at least 6 characters");
      return;
    }
    setPwMsg("✓ Password updated (mock — no real auth)");
    setPw({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwMsg(""), 3000);
  };

  return (
    <div className="space-y-7">
      {/* Avatar + identity */}
      <div
        className="flex items-center gap-4 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-mono font-bold text-white flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg,rgba(0,212,255,0.25),rgba(124,58,237,0.3))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {session?.avatar}
        </div>
        <div>
          <div className="font-semibold text-white">{session?.name}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
            <span className="capitalize">{session?.role}</span>
            <span className="w-1 h-1 rounded-full bg-slate-700 inline-block" />
            <span>{session?.email}</span>
          </div>
          <span
            className="mt-1.5 inline-block px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest"
            style={{
              background: "rgba(0,212,255,0.08)",
              color: "#00D4FF",
              border: "1px solid rgba(0,212,255,0.2)",
            }}
          >
            {session?.role === "admin"
              ? "Admin Access"
              : session?.role === "client"
                ? "Client Account"
                : "Freelancer Account"}
          </span>
        </div>
      </div>

      {/* Info fields */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Profile Information
        </h4>
        {[
          { k: "name", label: "Display Name", type: "text" },
          { k: "email", label: "Email Address", type: "email" },
          { k: "department", label: "Department / Team", type: "text" },
        ].map(({ k, label, type }) => (
          <div key={k}>
            <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
              {label}
            </label>
            <input
              type={type}
              value={form[k]}
              onChange={(e) => upd(k, e.target.value)}
              className={INPUT}
            />
          </div>
        ))}
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-black transition-all"
          style={{
            background: saved
              ? "linear-gradient(135deg,#10B981,#059669)"
              : "linear-gradient(135deg,#00D4FF,#7C3AED)",
          }}
        >
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            <>
              <Save size={14} /> Save Changes
            </>
          )}
        </button>
      </div>

      {/* Password */}
      <div
        className="space-y-4 pt-5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Change Password
        </h4>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.15)",
          }}
        >
          <Shield size={13} className="text-emerald-400" />
          <p className="text-emerald-400 text-xs font-mono">
            Session active — localStorage token present
          </p>
        </div>
        {[
          { k: "current", label: "Current Password" },
          { k: "next", label: "New Password" },
          { k: "confirm", label: "Confirm New Password" },
        ].map(({ k, label }) => (
          <div key={k} className="relative">
            <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
              {label}
            </label>
            <input
              type={showPass ? "text" : "password"}
              value={pw[k]}
              onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))}
              placeholder="••••••••"
              className={INPUT + " pr-12"}
            />
            {k === "next" && (
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 bottom-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            )}
          </div>
        ))}
        {pwMsg && (
          <p
            className={`text-xs font-mono ${pwMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}
          >
            {pwMsg}
          </p>
        )}
        <button
          onClick={handlePwSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs transition-all text-slate-200"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Shield size={14} className="text-cyan-400" /> Update Password
        </button>
      </div>
    </div>
  );
}

// ─── Notifications Section ─────────────────────────────────────────────────────
const NOTIF_ITEMS = [
  {
    id: "fraud_alerts",
    label: "Fraud Alerts",
    desc: "Notify when a freelancer exceeds risk threshold",
    color: "#EF4444",
    default: true,
  },
  {
    id: "team_complete",
    label: "Team Build Completions",
    desc: "Alert when CSP solver finishes",
    color: "#00D4FF",
    default: true,
  },
  {
    id: "project_match",
    label: "New Project Matches",
    desc: "When a matching project is posted",
    color: "#7C3AED",
    default: true,
  },
  {
    id: "weekly_digest",
    label: "Weekly Digest",
    desc: "Summary of platform activity every Monday",
    color: "#10B981",
    default: false,
  },
  {
    id: "review_anomaly",
    label: "Review Anomalies",
    desc: "Flag unusual review patterns on profiles",
    color: "#F59E0B",
    default: true,
  },
  {
    id: "contract_update",
    label: "Contract Updates",
    desc: "Status changes on active contracts",
    color: "#00D4FF",
    default: false,
  },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, n.default])),
  );
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        Notification Preferences
      </h4>
      <div className="space-y-2">
        {NOTIF_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 rounded-2xl transition-colors hover:bg-white/[0.02]"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: item.color }}
              />
              <div>
                <div className="text-sm font-medium text-white">
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  {item.desc}
                </div>
              </div>
            </div>
            <Toggle
              checked={prefs[item.id]}
              onChange={(v) => setPrefs((p) => ({ ...p, [item.id]: v }))}
              color={item.color}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-black"
          style={{
            background: saved
              ? "linear-gradient(135deg,#10B981,#059669)"
              : "linear-gradient(135deg,#00D4FF,#7C3AED)",
          }}
        >
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            <>
              <Save size={14} /> Save Preferences
            </>
          )}
        </button>
        <button
          onClick={() =>
            setPrefs(Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, false])))
          }
          className="px-4 py-2.5 rounded-xl font-mono text-xs text-slate-400 transition-colors hover:text-white"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Disable All
        </button>
        <button
          onClick={() =>
            setPrefs(Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, true])))
          }
          className="px-4 py-2.5 rounded-xl font-mono text-xs text-slate-400 transition-colors hover:text-white"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Enable All
        </button>
      </div>
    </div>
  );
}

// ─── AI Preferences Section ────────────────────────────────────────────────────
function AIPreferencesSection({ userId }: { userId: number }) {
  const [vals, setVals] = useState({
    notifications_enabled: true,
    email_alerts: true,
    fraud_sensitivity: 0.6,
    preferred_skills: [],
    theme: "dark",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    // Load user preferences from backend
    getUserSettings(userId)
      .then((res) => {
        setVals(res.preferences as any);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const set = (k: string, v: any) => setVals((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!userId) return;
    try {
      await updateUserSettings(userId, vals);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      console.error("Failed to save settings");
    }
  };

  if (loading)
    return <div className="text-slate-500">Loading preferences...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-1">
        <Sliders size={14} className="text-cyan-400" />
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          AI & Security Preferences
        </h4>
      </div>
      <div
        className="p-4 rounded-xl"
        style={{
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.12)",
        }}
      >
        <p className="text-[11px] font-mono text-cyan-400/80 leading-relaxed">
          Configure your fraud detection sensitivity and notification settings
        </p>
      </div>
      <div className="space-y-4">
        <div
          className="p-4 rounded-2xl space-y-3"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div>
            <div className="text-sm font-medium text-white">
              Fraud Detection Sensitivity
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Higher = more aggressive flagging at lower thresholds (0.0 to 1.0)
            </div>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={vals.fraud_sensitivity}
              onChange={(e) =>
                set("fraud_sensitivity", parseFloat(e.target.value))
              }
              className="w-full"
            />
            <div className="text-xs font-mono text-red-400 mt-2">
              {vals.fraud_sensitivity.toFixed(1)}
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl space-y-3"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div>
            <div className="text-sm font-medium text-white">
              Preferred Skills (comma-separated)
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Mark skills you want to focus on
            </div>
          </div>
          <input
            type="text"
            value={vals.preferred_skills?.join(", ") || ""}
            onChange={(e) =>
              set(
                "preferred_skills",
                e.target.value.split(",").map((s) => s.trim()),
              )
            }
            placeholder="Python, React, FastAPI"
            className={INPUT}
          />
        </div>

        <div
          className="p-4 rounded-2xl flex items-center justify-between"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div>
            <div className="text-sm font-medium text-white">
              Email Notifications
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Receive email alerts for important updates
            </div>
          </div>
          <Toggle
            checked={vals.email_alerts}
            onChange={(v) => set("email_alerts", v)}
            color="#00D4FF"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-black"
          style={{
            background: saved
              ? "linear-gradient(135deg,#10B981,#059669)"
              : "linear-gradient(135deg,#00D4FF,#7C3AED)",
          }}
        >
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            <>
              <Cpu size={14} /> Save Preferences
            </>
          )}
        </button>
        <button
          onClick={() =>
            setVals({
              notifications_enabled: true,
              email_alerts: true,
              fraud_sensitivity: 0.6,
              preferred_skills: [],
              theme: "dark",
            })
          }
          className="px-4 py-2.5 rounded-xl font-mono text-xs text-slate-400 transition-colors hover:text-white"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
}

// ─── Danger Zone Section ────────────────────────────────────────────────────────
function DangerZoneSection({ session }) {
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState(null);
  const required = action === "delete" ? "DELETE MY ACCOUNT" : "CLEAR SESSION";
  const canConfirm = confirmText === required;

  const handleAction = () => {
    if (!canConfirm) return;
    clearSession();
    signOut({ callbackUrl: "/login" });
    setShowConfirm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <AlertTriangle size={14} className="text-red-400" />
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-red-400">
          Danger Zone
        </h4>
      </div>

      {[
        {
          id: "logout",
          label: "Sign Out",
          desc: "End your current session and return to the login screen.",
          btnLabel: "Sign Out",
          color: "#F59E0B",
          confirmLabel: "CLEAR SESSION",
        },
        {
          id: "delete",
          label: "Delete Account",
          desc: "Permanently remove your account and all associated data. This action cannot be undone.",
          btnLabel: "Delete Account",
          color: "#EF4444",
          confirmLabel: "DELETE MY ACCOUNT",
        },
      ].map((item) => (
        <div
          key={item.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl"
          style={{
            background: `${item.color}08`,
            border: `1px solid ${item.color}22`,
          }}
        >
          <div>
            <div className="font-semibold text-white text-sm">{item.label}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono max-w-sm">
              {item.desc}
            </div>
          </div>
          <button
            onClick={() => {
              setAction(item.id);
              setShowConfirm(true);
              setConfirmText("");
            }}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              color: item.color,
              background: `${item.color}15`,
              border: `1px solid ${item.color}35`,
            }}
          >
            {item.btnLabel}
          </button>
        </div>
      ))}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
            }}
            onClick={(e) =>
              e.target === e.currentTarget && setShowConfirm(false)
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-6 space-y-5"
              style={{
                background: "#0D1117",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">
                      {action === "delete"
                        ? "Confirm Account Deletion"
                        : "Confirm Sign Out"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      This action is irreversible
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono text-slate-400">
                  Type{" "}
                  <span className="text-red-400 font-bold">{required}</span> to
                  confirm:
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={required}
                  className="w-full bg-white/5 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-red-500/50 font-mono"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-mono text-slate-400 transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={!canConfirm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold text-white uppercase tracking-wider transition-all disabled:opacity-30"
                  style={{
                    background: "rgba(239,68,68,0.8)",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [active, setActive] = useState("profile");
  const [session, setSessionState] = useState(null);

  useEffect(() => {
    setSessionState(getSession());
  }, []);

  const userId = session?.id || 1; // Fallback to 1 if no session ID

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 pb-10 max-w-4xl">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-slate-400" />
          <h2 className="text-xl font-bold text-white">Settings</h2>
          {session && (
            <span
              className="ml-2 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest"
              style={{
                background: "rgba(0,212,255,0.08)",
                color: "#00D4FF",
                border: "1px solid rgba(0,212,255,0.18)",
              }}
            >
              {session.role}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Section nav */}
          <div
            className="md:w-52 rounded-2xl p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible flex-shrink-0"
            style={{
              background: "rgba(17,24,39,0.7)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest whitespace-nowrap transition-all"
                style={
                  active === id
                    ? {
                        background:
                          id === "danger"
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(0,212,255,0.1)",
                        color: id === "danger" ? "#EF4444" : "#00D4FF",
                        border: `1px solid ${id === "danger" ? "rgba(239,68,68,0.2)" : "rgba(0,212,255,0.2)"}`,
                      }
                    : { color: id === "danger" ? "#EF444490" : "#64748B" }
                }
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="p-6 rounded-2xl"
                style={{
                  background: "rgba(17,24,39,0.7)",
                  border: `1px solid ${active === "danger" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                {active === "profile" && (
                  <ProfileSection
                    session={session}
                    onSessionUpdate={setSessionState}
                  />
                )}
                {active === "notifications" && <NotificationsSection />}
                {active === "ai" && <AIPreferencesSection userId={userId} />}
                {active === "danger" && <DangerZoneSection session={session} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
