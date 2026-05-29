"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Search,
  Users,
  ShieldAlert,
  Share2,
  FolderOpen,
  Settings,
  BarChart3,
  Database,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { getSession, isAdmin } from "@/utils/clearhire-auth";

const ALL_ROUTES = [
  {
    section: "Intelligence",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/search", label: "Talent Search", icon: Search },
      { href: "/team-builder", label: "Team Builder", icon: Users },
      { href: "/fraud", label: "Fraud Lab", icon: ShieldAlert },
      { href: "/graph", label: "Skill Graph", icon: Share2 },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderOpen },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    section: "Admin",
    adminOnly: true,
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/data-manager", label: "Data Manager", icon: Database },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const [current, setCurrent] = useState("/");
  const session = getSession();

  useEffect(() => {
    setCurrent(window.location.pathname);
  }, []);

  const isActive = (href) => current === href;

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-[#0D1117] border-r border-white/5 overflow-hidden z-40 flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-white/5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
            <Zap size={16} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="ml-3 font-mono font-bold text-white tracking-wider text-sm uppercase whitespace-nowrap"
              >
                ClearHire
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-none">
          {ALL_ROUTES.map((section) => {
            if (section.adminOnly && !isAdmin(session)) return null;
            return (
              <div key={section.section} className="mb-6">
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4 mb-2"
                    >
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600">
                        {section.section}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <a
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl mb-1 transition-all group relative ${
                        active
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            transition={{ duration: 0.15 }}
                            className="text-xs font-medium whitespace-nowrap"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {active && (
                        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-12 border-t border-white/5 text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </motion.aside>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0D1117]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 py-2">
        {ALL_ROUTES[0].items.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <a
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                active ? "text-cyan-400" : "text-slate-600 hover:text-slate-300"
              }`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-mono uppercase tracking-wider">
                {label.split(" ")[0]}
              </span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
