"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const DEMO_ROLES = [
  { role: "admin", label: "Admin Demo", colorVar: "var(--color-secondary)", rgbVar: "var(--color-secondary-rgb)" },
  { role: "client", label: "Client Demo", colorVar: "var(--color-primary)", rgbVar: "var(--color-primary-rgb)" },
  { role: "freelancer", label: "Freelancer Demo", colorVar: "var(--color-success)", rgbVar: "var(--color-success-rgb)" },
];

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "client" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
      mode: mode === "login" ? "login" : "register",
      name: form.name,
      registerRole: form.role,
    });
    setLoading(false);
    if (result?.error) {
      setError(mode === "login" ? "Invalid email or password" : "Registration failed — email may already exist");
      return;
    }
    router.replace("/dashboard");
  };

  const handleDemo = async (role: string) => {
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      mode: "demo",
      demoRole: role,
      email: "demo@clearhire.ai",
      password: "demo",
    });
    setLoading(false);
    if (result?.error) { setError("Demo login failed"); return; }
    router.replace("/dashboard");
  };

  const inputCls = [
    "w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-colors",
  ].join(" ");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Background glow blobs */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: `rgba(var(--color-primary-rgb), 0.05)` }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: `rgba(var(--color-secondary-rgb), 0.05)` }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-mono font-bold tracking-wider uppercase" style={{ color: "var(--text-primary)" }}>
            ClearHire
          </h1>
          <p className="text-sm mt-1 font-mono" style={{ color: "var(--text-subtle)" }}>
            Recruitment Intelligence System
          </p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{
            background: `rgba(var(--bg-secondary-rgb), 0.8)`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid rgba(var(--border-base), 0.07)`,
          }}
        >
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: `rgba(var(--border-base), 0.05)` }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
                style={
                  mode === m
                    ? {
                        background: `rgba(var(--color-primary-rgb), 0.1)`,
                        color: "var(--color-primary)",
                        border: `1px solid rgba(var(--color-primary-rgb), 0.2)`,
                      }
                    : { color: "var(--text-subtle)" }
                }
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === "login" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {mode === "register" && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>
                    Full Name
                  </label>
                  <input
                    type="text" required value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Alex Rivera"
                    className={inputCls}
                    style={{
                      background: `rgba(var(--border-base), 0.05)`,
                      border: `1px solid rgba(var(--border-base), 0.1)`,
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>
                  Email Address
                </label>
                <input
                  type="email" required value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@clearhire.ai"
                  className={inputCls}
                  style={{
                    background: `rgba(var(--border-base), 0.05)`,
                    border: `1px solid rgba(var(--border-base), 0.1)`,
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} required value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="••••••••"
                    className={inputCls + " pr-11"}
                    style={{
                      background: `rgba(var(--border-base), 0.05)`,
                      border: `1px solid rgba(var(--border-base), 0.1)`,
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-subtle)" }}>
                    Role
                  </label>
                  <select
                    value={form.role} onChange={(e) => update("role", e.target.value)}
                    className={inputCls}
                    style={{
                      background: `rgba(var(--bg-secondary-rgb), 0.95)`,
                      border: `1px solid rgba(var(--border-base), 0.1)`,
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="client">Client — Hire talent</option>
                    <option value="freelancer">Freelancer — Get hired</option>
                  </select>
                </div>
              )}

              {error && (
                <div
                  className="px-4 py-3 rounded-xl text-xs font-mono"
                  style={{
                    background: `rgba(var(--color-danger-rgb), 0.1)`,
                    border: `1px solid rgba(var(--color-danger-rgb), 0.2)`,
                    color: "var(--color-danger)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full font-mono font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                style={{ background: `linear-gradient(135deg, var(--color-primary), rgba(var(--color-secondary-rgb), 0.8))` }}
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === "login" ? (
                  <><LogIn size={16} /> AUTHENTICATE</>
                ) : (
                  <><UserPlus size={16} /> CREATE ACCOUNT</>
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Demo access */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: `rgba(var(--border-base), 0.05)` }} />
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
                Demo Access
              </span>
              <div className="flex-1 h-px" style={{ background: `rgba(var(--border-base), 0.05)` }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map(({ role, label, colorVar, rgbVar }) => (
                <button
                  key={role} type="button" disabled={loading}
                  onClick={() => handleDemo(role)}
                  className="py-2 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all"
                  style={{
                    color: colorVar,
                    border: `1px solid rgba(${rgbVar}, 0.3)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = `rgba(${rgbVar}, 0.1)`;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${rgbVar}, 0.6)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${rgbVar}, 0.3)`;
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
