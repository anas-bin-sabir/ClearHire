"use client";

import { useState, useEffect } from "react";
import { Bell, LogOut, ChevronDown, Shield, User, Briefcase, Sun, Moon, Search } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { getSession, clearSession } from "@/utils/clearhire-auth";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/lib/ThemeContext";

interface RoleConfig {
  label: string;
  variant: "primary" | "success" | "warning";
  icon: React.ComponentType<{ size: number }>;
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  admin:      { label: "Admin",      variant: "warning", icon: Shield },
  client:     { label: "Client",     variant: "primary", icon: Briefcase },
  freelancer: { label: "Freelancer", variant: "success", icon: User },
};

const DUMMY_NOTIFICATIONS = [
  { id: 1, text: "Fraud signal detected — Account #8241 flagged for review", time: "2m ago", type: "warning" as const },
  { id: 2, text: "Team build completed for Neo-Banking UI project",           time: "14m ago", type: "success" as const },
  { id: 3, text: "Search matched 24 candidates for your open role",          time: "1h ago",  type: "info" as const },
];

export default function TopBar({ pageTitle }: { pageTitle?: string }) {
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();

  useEffect(() => { setSession(getSession()); }, []);

  const role = ROLE_CONFIG[session?.role || "client"] ?? ROLE_CONFIG.client;
  const RoleIcon = role.icon;

  const roleBadgeCls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  }[role.variant];

  return (
    <header className="h-16 flex items-center px-5 gap-4 sticky top-0 z-30 flex-shrink-0 bg-background/80 backdrop-blur-xl">
      <div className="w-40 flex-shrink-0 hidden md:block">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">
          {pageTitle || "ClearHire"}
        </p>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-sm hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
          <input
            type="search"
            placeholder="Search talent, skills, projects…"
            aria-label="Global search"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-card text-foreground placeholder:text-muted/50 focus:ring-2 focus:ring-ring/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
          className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-card transition-colors"
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUser(false); }}
            aria-label="Notifications"
            aria-expanded={showNotifs}
            className="relative p-2 rounded-xl text-muted hover:text-foreground hover:bg-card transition-colors"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                className="absolute right-0 top-12 w-80 rounded-xl bg-card-elevated shadow-lg overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  <span className="text-xs text-primary font-medium">{DUMMY_NOTIFICATIONS.length} new</span>
                </div>
                {DUMMY_NOTIFICATIONS.map((n, i) => (
                  <div
                    key={n.id}
                    className={[
                      "px-4 py-3 hover:bg-background/50 transition-colors",
                      i < DUMMY_NOTIFICATIONS.length - 1 && "border-b border-border/20",
                    ].filter(Boolean).join(" ")}
                  >
                    <p className="text-sm text-muted leading-relaxed">{n.text}</p>
                    <p className="text-xs text-muted/60 mt-1">{n.time}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {session && (
          <>
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${roleBadgeCls}`}>
              <RoleIcon size={11} />
              {role.label}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowUser(!showUser); setShowNotifs(false); }}
                aria-label="User menu"
                aria-expanded={showUser}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-card transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                  {session.avatar}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-foreground leading-none">{session.name}</div>
                  <div className="text-xs text-muted mt-0.5">{session.department}</div>
                </div>
                <ChevronDown size={13} className="text-muted hidden sm:block" />
              </button>

              <AnimatePresence>
                {showUser && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    className="absolute right-0 top-12 w-52 rounded-xl bg-card-elevated shadow-lg overflow-hidden"
                  >
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{session.name}</p>
                      <p className="text-xs text-muted mt-0.5">{session.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-background/50 transition-colors">
                        <User size={14} /> Settings
                      </Link>
                      <button
                        onClick={() => { clearSession(); signOut({ callbackUrl: "/login" }); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/8 transition-colors"
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
