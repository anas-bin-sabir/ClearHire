"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { login, register, demoLogin, getSession } from "@/utils/clearhire-auth";

const DEMO_ROLES = [
  {
    role: "admin",
    label: "Admin Demo",
    color: "text-violet-400",
    border:
      "border-violet-500/30 hover:border-violet-400/60 hover:bg-violet-500/10",
  },
  {
    role: "client",
    label: "Client Demo",
    color: "text-cyan-400",
    border: "border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/10",
  },
  {
    role: "freelancer",
    label: "Freelancer Demo",
    color: "text-emerald-400",
    border:
      "border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10",
  },
];

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "client",
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) window.location.href = "/dashboard";
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result =
      mode === "login"
        ? login(form.email, form.password)
        : register(form.name, form.email, form.password, form.role);
    setLoading(false);
    if (!result.success) return setError(result.error);
    window.location.href = "/dashboard";
  };

  const handleDemo = (role) => {
    const result = demoLogin(role);
    if (result.success) window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 mb-4">
            <Zap size={24} className="text-black" />
          </div>
          <h1 className="text-2xl font-mono font-bold text-white tracking-wider uppercase">
            ClearHire
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            Recruitment Intelligence System
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(17, 24, 39, 0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
          className="rounded-3xl p-8"
        >
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all ${
                  mode === m
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "text-slate-500 hover:text-slate-300"
                }`}
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
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@clearhire.ai"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1.5">
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => update("role", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  >
                    <option value="client">Client — Hire talent</option>
                    <option value="freelancer">Freelancer — Get hired</option>
                  </select>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-mono font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span
                    className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    style={{ animation: "spin 0.6s linear infinite" }}
                  />
                ) : mode === "login" ? (
                  <>
                    <LogIn size={16} /> AUTHENTICATE
                  </>
                ) : (
                  <>
                    <UserPlus size={16} /> CREATE ACCOUNT
                  </>
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Demo Access */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                Demo Access
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map(({ role, label, color, border }) => (
                <button
                  key={role}
                  onClick={() => handleDemo(role)}
                  className={`py-2 rounded-xl border text-[10px] font-mono uppercase tracking-wider transition-all ${color} ${border}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
