"use client";
import { useState, useEffect } from "react";
import { Bell, LogOut, ChevronDown, Shield, User, Briefcase, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { getSession, clearSession } from "@/utils/clearhire-auth";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/lib/ThemeContext";

interface RoleConfig {
  label: string;
  colorVar: string;
  icon: React.ComponentType<{ size: number }>;
}

interface Notification {
  id: number;
  text: string;
  time: string;
  type: "warning" | "success" | "info";
}

interface Session {
  role: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  admin: { label: "Admin", colorVar: "var(--color-secondary)", icon: Shield },
  client: { label: "Client", colorVar: "var(--color-primary)", icon: Briefcase },
  freelancer: { label: "Freelancer", colorVar: "var(--color-success)", icon: User },
};

const DUMMY_NOTIFICATIONS: Notification[] = [
  { id: 1, text: "New fraud signal detected on Account #8241", time: "2m ago", type: "warning" },
  { id: 2, text: "Team build completed for Neo-Banking UI", time: "14m ago", type: "success" },
  { id: 3, text: "A* search matched 24 candidates", time: "1h ago", type: "info" },
];

interface TopBarProps {
  pageTitle?: string;
}

export default function TopBar({ pageTitle }: TopBarProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [showNotifs, setShowNotifs] = useState<boolean>(false);
  const [showUser, setShowUser] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setSession(getSession() as Session | null);
  }, []);

  const role = ROLE_CONFIG[session?.role || "client"] || ROLE_CONFIG.client;
  const RoleIcon = role.icon;

  return (
    <header
      className="h-16 flex items-center px-6 gap-4 sticky top-0 z-30 flex-shrink-0 backdrop-blur-xl"
      style={{
        borderBottom: `1px solid rgba(var(--border-base), 0.05)`,
        background: `rgba(var(--bg-primary-rgb), 0.8)`,
      }}
    >
      {/* Page Title */}
      <div className="flex-1">
        <h1
          className="text-sm font-mono uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          {pageTitle || "ClearHire Intelligence"}
        </h1>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-all"
          style={{ color: "var(--text-subtle)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-subtle)")
          }
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUser(false); }}
            className="relative p-2 rounded-xl transition-all"
            style={{ color: "var(--text-subtle)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-subtle)")
            }
          >
            <Bell size={18} />
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--color-primary)" }}
            />
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                style={{
                  background: "var(--bg-secondary)",
                  border: `1px solid rgba(var(--border-base), 0.1)`,
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}
                >
                  <span
                    className="text-xs font-mono uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Intelligence Alerts
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {DUMMY_NOTIFICATIONS.length} NEW
                  </span>
                </div>
                {DUMMY_NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 cursor-default transition-colors"
                    style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background =
                        `rgba(var(--border-base), 0.03)`)
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "")
                    }
                  >
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {n.text}
                    </p>
                    <p
                      className="text-[10px] font-mono mt-1"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {n.time}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Role Badge */}
        {session && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-widest"
            style={{
              color: role.colorVar,
              background: `${role.colorVar}18`,
              borderColor: `${role.colorVar}40`,
            }}
          >
            <RoleIcon size={12} />
            {role.label}
          </div>
        )}

        {/* User Menu */}
        {session && (
          <div className="relative">
            <button
              onClick={() => { setShowUser(!showUser); setShowNotifs(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl transition-all"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  `rgba(var(--border-base), 0.05)`)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "")
              }
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold"
                style={{
                  background: `linear-gradient(135deg, rgba(var(--color-primary-rgb),0.3), rgba(var(--color-secondary-rgb),0.3))`,
                  border: `1px solid rgba(var(--border-base), 0.1)`,
                  color: "var(--text-primary)",
                }}
              >
                {session.avatar}
              </div>
              <div className="hidden sm:block text-left">
                <div
                  className="text-xs font-medium leading-none mb-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {session.name}
                </div>
                <div
                  className="text-[10px] font-mono"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {session.department}
                </div>
              </div>
              <ChevronDown size={14} style={{ color: "var(--text-subtle)" }} />
            </button>

            <AnimatePresence>
              {showUser && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-56 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                  style={{
                    background: "var(--bg-secondary)",
                    border: `1px solid rgba(var(--border-base), 0.1)`,
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}
                  >
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {session.name}
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {session.email}
                    </p>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                        (e.currentTarget as HTMLAnchorElement).style.background = `rgba(var(--border-base), 0.05)`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
                        (e.currentTarget as HTMLAnchorElement).style.background = "";
                      }}
                    >
                      <User size={14} /> Profile Settings
                    </Link>
                    <button
                      onClick={() => { clearSession(); signOut({ callbackUrl: "/login" }); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                      style={{ color: "var(--color-danger)" }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background =
                          `rgba(var(--color-danger-rgb), 0.1)`)
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "")
                      }
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
