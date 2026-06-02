"use client";
import { useState, useEffect } from "react";
import {
  Bell,
  LogOut,
  ChevronDown,
  Shield,
  User,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { getSession, clearSession } from "@/utils/clearhire-auth";
import { motion, AnimatePresence } from "motion/react";

interface RoleConfig {
  label: string;
  color: string;
  bg: string;
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
  admin: {
    label: "Admin",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    icon: Shield,
  },
  client: {
    label: "Client",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    icon: Briefcase,
  },
  freelancer: {
    label: "Freelancer",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: User,
  },
};

const DUMMY_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    text: "New fraud signal detected on Account #8241",
    time: "2m ago",
    type: "warning",
  },
  {
    id: 2,
    text: "Team build completed for Neo-Banking UI",
    time: "14m ago",
    type: "success",
  },
  {
    id: 3,
    text: "A* search matched 24 candidates",
    time: "1h ago",
    type: "info",
  },
];

interface TopBarProps {
  pageTitle?: string;
}

export default function TopBar({ pageTitle }: TopBarProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [showNotifs, setShowNotifs] = useState<boolean>(false);
  const [showUser, setShowUser] = useState<boolean>(false);

  useEffect(() => {
    setSession(getSession() as Session | null);
  }, []);

  const role = ROLE_CONFIG[session?.role || "client"] || ROLE_CONFIG.client;
  const RoleIcon = role.icon;

  return (
    <header className="h-16 border-b border-white/5 bg-[#0A0D14]/80 backdrop-blur-xl flex items-center px-6 gap-4 sticky top-0 z-30 flex-shrink-0">
      {/* Page Title */}
      <div className="flex-1">
        <h1 className="text-sm font-mono text-slate-400 uppercase tracking-[0.2em]">
          {pageTitle || "ClearHire Intelligence"}
        </h1>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              setShowUser(false);
            }}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    Intelligence Alerts
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {DUMMY_NOTIFICATIONS.length} NEW
                  </span>
                </div>
                {DUMMY_NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-default transition-colors"
                  >
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {n.text}
                    </p>
                    <p className="text-[10px] font-mono text-slate-600 mt-1">
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
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-widest ${role.bg} ${role.color}`}
          >
            <RoleIcon size={12} />
            {role.label}
          </div>
        )}

        {/* User Menu */}
        {session && (
          <div className="relative">
            <button
              onClick={() => {
                setShowUser(!showUser);
                setShowNotifs(false);
              }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/5 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-[11px] font-mono font-bold text-white">
                {session.avatar}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-slate-200 leading-none mb-0.5">
                  {session.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {session.department}
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-600" />
            </button>

            <AnimatePresence>
              {showUser && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-56 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-semibold text-white">
                      {session.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {session.email}
                    </p>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <User size={14} /> Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        clearSession();
                        signOut({ callbackUrl: "/login" });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-all"
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
