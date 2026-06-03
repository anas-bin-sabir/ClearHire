"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, User, Shield, Bell, Cpu, Trash2, Save, Check, Eye, EyeOff, AlertTriangle, Sliders, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { getSession, setCachedSession, clearSession } from "@/utils/clearhire-auth";
import { getUserSettings, updateUserSettings, type UserPreferences } from "@/lib/api";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Preferences", icon: Cpu },
  { id: "danger", label: "Danger Zone", icon: Trash2 },
];

const INPUT = "w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-colors";

const inputStyle = {
  background: `rgba(var(--border-base), 0.05)`,
  border: `1px solid rgba(var(--border-base), 0.1)`,
  color: "var(--text-primary)",
};

function Toggle({ checked, onChange, colorVar = "var(--color-primary)" }: { checked: boolean; onChange: (v: boolean) => void; colorVar?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? `rgba(var(--color-primary-rgb), 0.3)` : `rgba(var(--border-base), 0.08)`, border: `1px solid ${checked ? `rgba(var(--color-primary-rgb), 0.5)` : `rgba(var(--border-base), 0.12)`}` }}>
      <motion.div animate={{ x: checked ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="absolute top-1 w-4 h-4 rounded-full" style={{ background: checked ? colorVar : "var(--text-muted)" }} />
    </button>
  );
}

function ProfileSection({ session, onSessionUpdate }: { session: any; onSessionUpdate: (s: any) => void }) {
  const [form, setForm] = useState({ name: session?.name ?? "", email: session?.email ?? "", department: session?.department ?? "" });
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    const updated = { ...session, ...form };
    setCachedSession(updated);
    onSessionUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handlePwSave = () => {
    if (!pw.next || pw.next !== pw.confirm) { setPwMsg("Passwords do not match"); return; }
    if (pw.next.length < 6) { setPwMsg("Password must be at least 6 characters"); return; }
    setPwMsg("✓ Password updated (mock — no real auth)");
    setPw({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwMsg(""), 3000);
  };

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4 pb-5" style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-mono font-bold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.25), rgba(var(--color-secondary-rgb),0.3))`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" }}>
          {session?.avatar}
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{session?.name}</div>
          <div className="text-xs font-mono mt-0.5 flex items-center gap-2" style={{ color: "var(--text-subtle)" }}>
            <span className="capitalize">{session?.role}</span>
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: "var(--text-muted)" }} />
            <span>{session?.email}</span>
          </div>
          <span className="mt-1.5 inline-block px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest"
            style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, color: "var(--color-primary)", border: `1px solid rgba(var(--color-primary-rgb), 0.2)` }}>
            {session?.role === "admin" ? "Admin Access" : session?.role === "client" ? "Client Account" : "Freelancer Account"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Profile Information</h4>
        {[{ k: "name", label: "Display Name", type: "text" }, { k: "email", label: "Email Address", type: "email" }, { k: "department", label: "Department / Team", type: "text" }].map(({ k, label, type }) => (
          <div key={k}>
            <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>{label}</label>
            <input type={type} value={form[k as keyof typeof form]} onChange={(e) => upd(k, e.target.value)} className={INPUT} style={inputStyle} />
          </div>
        ))}
        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-white transition-all"
          style={{ background: saved ? `linear-gradient(135deg, var(--color-success), rgba(var(--color-success-rgb), 0.7))` : `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>

      <div className="space-y-4 pt-5" style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)` }}>
        <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Change Password</h4>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `rgba(var(--color-success-rgb), 0.06)`, border: `1px solid rgba(var(--color-success-rgb), 0.15)` }}>
          <Shield size={13} style={{ color: "var(--color-success)" }} />
          <p className="text-xs font-mono" style={{ color: "var(--color-success)" }}>Session active — localStorage token present</p>
        </div>
        {[{ k: "current", label: "Current Password" }, { k: "next", label: "New Password" }, { k: "confirm", label: "Confirm New Password" }].map(({ k, label }) => (
          <div key={k} className="relative">
            <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>{label}</label>
            <input type={showPass ? "text" : "password"} value={pw[k as keyof typeof pw]} onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))} placeholder="••••••••" className={INPUT + " pr-12"} style={inputStyle} />
            {k === "next" && <button onClick={() => setShowPass(!showPass)} className="absolute right-4 bottom-3.5 transition-colors" style={{ color: "var(--text-subtle)" }}>{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
          </div>
        ))}
        {pwMsg && <p className="text-xs font-mono" style={{ color: pwMsg.startsWith("✓") ? "var(--color-success)" : "var(--color-danger)" }}>{pwMsg}</p>}
        <button onClick={handlePwSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs transition-all"
          style={{ background: `rgba(var(--border-base), 0.06)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-secondary)" }}>
          <Shield size={14} style={{ color: "var(--color-primary)" }} /> Update Password
        </button>
      </div>
    </div>
  );
}

const NOTIF_ITEMS = [
  { id: "fraud_alerts", label: "Fraud Alerts", desc: "Notify when a freelancer exceeds risk threshold", colorVar: "var(--color-danger)", default: true },
  { id: "team_complete", label: "Team Build Completions", desc: "Alert when CSP solver finishes", colorVar: "var(--color-primary)", default: true },
  { id: "project_match", label: "New Project Matches", desc: "When a matching project is posted", colorVar: "var(--color-secondary)", default: true },
  { id: "weekly_digest", label: "Weekly Digest", desc: "Summary of platform activity every Monday", colorVar: "var(--color-success)", default: false },
  { id: "review_anomaly", label: "Review Anomalies", desc: "Flag unusual review patterns on profiles", colorVar: "var(--color-warning)", default: true },
  { id: "contract_update", label: "Contract Updates", desc: "Status changes on active contracts", colorVar: "var(--color-primary)", default: false },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState(() => Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, n.default])));
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Notification Preferences</h4>
      <div className="space-y-2">
        {NOTIF_ITEMS.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl transition-colors"
            style={{ background: `rgba(var(--border-base), 0.02)`, border: `1px solid rgba(var(--border-base), 0.05)` }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = `rgba(var(--border-base), 0.04)`)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = `rgba(var(--border-base), 0.02)`)}>
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: item.colorVar }} />
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                <div className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--text-subtle)" }}>{item.desc}</div>
              </div>
            </div>
            <Toggle checked={prefs[item.id]} onChange={(v) => setPrefs((p) => ({ ...p, [item.id]: v }))} colorVar={item.colorVar} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-white"
          style={{ background: saved ? `linear-gradient(135deg, var(--color-success), rgba(var(--color-success-rgb),0.7))` : `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
          {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Preferences</>}
        </button>
        {[{ label: "Disable All", fn: () => setPrefs(Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, false]))) }, { label: "Enable All", fn: () => setPrefs(Object.fromEntries(NOTIF_ITEMS.map((n) => [n.id, true]))) }].map((btn) => (
          <button key={btn.label} onClick={btn.fn} className="px-4 py-2.5 rounded-xl font-mono text-xs transition-colors"
            style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AIPreferencesSection({ userId }: { userId: number }) {
  const [vals, setVals] = useState({ notifications_enabled: true, email_alerts: true, fraud_sensitivity: 0.6, preferred_skills: [] as string[], theme: "dark" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getUserSettings(userId).then((res) => setVals(res.preferences as any)).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const set = (k: string, v: any) => setVals((p) => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!userId) return;
    try { await updateUserSettings(userId, vals); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch {}
  };

  if (loading) return <div className="font-mono text-sm" style={{ color: "var(--text-subtle)" }}>Loading preferences...</div>;

  const cardStyle = { background: `rgba(var(--border-base), 0.02)`, border: `1px solid rgba(var(--border-base), 0.05)` };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-1">
        <Sliders size={14} style={{ color: "var(--color-primary)" }} />
        <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>AI & Security Preferences</h4>
      </div>
      <div className="p-4 rounded-xl" style={{ background: `rgba(var(--color-primary-rgb), 0.04)`, border: `1px solid rgba(var(--color-primary-rgb), 0.12)` }}>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: `rgba(var(--color-primary-rgb), 0.8)` }}>Configure your fraud detection sensitivity and notification settings</p>
      </div>
      <div className="space-y-4">
        <div className="p-4 rounded-2xl space-y-3" style={cardStyle}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Fraud Detection Sensitivity</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>Higher = more aggressive flagging at lower thresholds (0.0 to 1.0)</div>
          </div>
          <div className="relative">
            <input type="range" min="0" max="1" step="0.1" value={vals.fraud_sensitivity} onChange={(e) => set("fraud_sensitivity", parseFloat(e.target.value))} className="w-full" style={{ accentColor: "var(--color-danger)" }} />
            <div className="text-xs font-mono mt-2" style={{ color: "var(--color-danger)" }}>{vals.fraud_sensitivity.toFixed(1)}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl space-y-3" style={cardStyle}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Preferred Skills (comma-separated)</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>Mark skills you want to focus on</div>
          </div>
          <input type="text" value={vals.preferred_skills?.join(", ") || ""} onChange={(e) => set("preferred_skills", e.target.value.split(",").map((s) => s.trim()))} placeholder="Python, React, FastAPI" className={INPUT} style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.1)`, color: "var(--text-primary)" }} />
        </div>
        <div className="p-4 rounded-2xl flex items-center justify-between" style={cardStyle}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Email Notifications</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>Receive email alerts for important updates</div>
          </div>
          <Toggle checked={vals.email_alerts} onChange={(v) => set("email_alerts", v)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono font-bold text-xs text-white"
          style={{ background: saved ? `linear-gradient(135deg, var(--color-success), rgba(var(--color-success-rgb),0.7))` : `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
          {saved ? <><Check size={14} /> Saved</> : <><Cpu size={14} /> Save Preferences</>}
        </button>
        <button onClick={() => setVals({ notifications_enabled: true, email_alerts: true, fraud_sensitivity: 0.6, preferred_skills: [], theme: "dark" })} className="px-4 py-2.5 rounded-xl font-mono text-xs transition-colors"
          style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}>
          Reset Defaults
        </button>
      </div>
    </div>
  );
}

function DangerZoneSection({ session }: { session: any }) {
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const required = action === "delete" ? "DELETE MY ACCOUNT" : "CLEAR SESSION";
  const canConfirm = confirmText === required;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <AlertTriangle size={14} style={{ color: "var(--color-danger)" }} />
        <h4 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-danger)" }}>Danger Zone</h4>
      </div>
      {[
        { id: "logout", label: "Sign Out", desc: "End your current session and return to the login screen.", btnLabel: "Sign Out", colorVar: "var(--color-warning)", rgbVar: "var(--color-warning-rgb)" },
        { id: "delete", label: "Delete Account", desc: "Permanently remove your account and all associated data. This action cannot be undone.", btnLabel: "Delete Account", colorVar: "var(--color-danger)", rgbVar: "var(--color-danger-rgb)" },
      ].map((item) => (
        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl"
          style={{ background: `rgba(${item.rgbVar}, 0.08)`, border: `1px solid rgba(${item.rgbVar}, 0.22)` }}>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.label}</div>
            <div className="text-[11px] mt-0.5 font-mono max-w-sm" style={{ color: "var(--text-subtle)" }}>{item.desc}</div>
          </div>
          <button onClick={() => { setAction(item.id); setShowConfirm(true); setConfirmText(""); }}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all"
            style={{ color: item.colorVar, background: `rgba(${item.rgbVar}, 0.15)`, border: `1px solid rgba(${item.rgbVar}, 0.35)` }}>
            {item.btnLabel}
          </button>
        </div>
      ))}

      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-6 space-y-5"
              style={{ background: "var(--bg-surface)", border: `1px solid rgba(var(--color-danger-rgb), 0.25)` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `rgba(var(--color-danger-rgb), 0.1)`, border: `1px solid rgba(var(--color-danger-rgb), 0.2)` }}>
                    <AlertTriangle size={18} style={{ color: "var(--color-danger)" }} />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{action === "delete" ? "Confirm Account Deletion" : "Confirm Sign Out"}</div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>This action is irreversible</div>
                  </div>
                </div>
                <button onClick={() => setShowConfirm(false)} className="transition-colors" style={{ color: "var(--text-subtle)" }}><X size={16} /></button>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                  Type <span className="font-bold" style={{ color: "var(--color-danger)" }}>{required}</span> to confirm:
                </p>
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={required}
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none"
                  style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--color-danger-rgb), 0.25)`, color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl text-xs font-mono transition-colors"
                  style={{ background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)`, color: "var(--text-muted)" }}>
                  Cancel
                </button>
                <button onClick={() => { if (!canConfirm) return; clearSession(); signOut({ callbackUrl: "/login" }); setShowConfirm(false); }} disabled={!canConfirm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-mono font-bold text-white uppercase tracking-wider transition-all disabled:opacity-30"
                  style={{ background: `rgba(var(--color-danger-rgb), 0.8)`, border: `1px solid rgba(var(--color-danger-rgb), 0.3)` }}>
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

export default function SettingsPage() {
  const [active, setActive] = useState("profile");
  const [session, setSessionState] = useState<any>(null);

  useEffect(() => { setSessionState(getSession()); }, []);
  const userId = session?.id || 1;

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 pb-10 max-w-4xl">
        <div className="flex items-center gap-2">
          <Settings size={18} style={{ color: "var(--text-muted)" }} />
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h2>
          {session && (
            <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest"
              style={{ background: `rgba(var(--color-primary-rgb), 0.08)`, color: "var(--color-primary)", border: `1px solid rgba(var(--color-primary-rgb), 0.18)` }}>
              {session.role}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-52 rounded-2xl p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible flex-shrink-0"
            style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.05)` }}>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActive(id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest whitespace-nowrap transition-all"
                style={
                  active === id
                    ? { background: id === "danger" ? `rgba(var(--color-danger-rgb), 0.1)` : `rgba(var(--color-primary-rgb), 0.1)`, color: id === "danger" ? "var(--color-danger)" : "var(--color-primary)", border: `1px solid ${id === "danger" ? `rgba(var(--color-danger-rgb), 0.2)` : `rgba(var(--color-primary-rgb), 0.2)`}` }
                    : { color: id === "danger" ? `rgba(var(--color-danger-rgb), 0.6)` : "var(--text-subtle)" }
                }>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
                className="p-6 rounded-2xl"
                style={{ background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid ${active === "danger" ? `rgba(var(--color-danger-rgb), 0.15)` : `rgba(var(--border-base), 0.05)`}` }}>
                {active === "profile" && <ProfileSection session={session} onSessionUpdate={setSessionState} />}
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
