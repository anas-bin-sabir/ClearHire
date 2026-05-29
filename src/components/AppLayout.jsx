"use client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { getSession } from "@/utils/clearhire-auth";

export default function AppLayout({ children, title }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Restore sidebar pref
    const saved = localStorage.getItem("clearhire_sidebar");
    if (saved === "collapsed") setCollapsed(true);

    // Auth guard
    const session = getSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }

    setAuthed(true);
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("clearhire_sidebar", next ? "collapsed" : "open");
  };

  if (!mounted || !authed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0D14]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 animate-pulse" />
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest animate-pulse">
            Initializing Intelligence Systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0D14] overflow-hidden">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar pageTitle={title} />

        {/* Page Content with fade + up transition */}
        <motion.main
          key={
            typeof window !== "undefined" ? window.location.pathname : "page"
          }
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 overflow-y-auto px-6 py-8 pb-24 md:pb-8"
        >
          {/* Subtle grid background */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              zIndex: 0,
            }}
          />
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
